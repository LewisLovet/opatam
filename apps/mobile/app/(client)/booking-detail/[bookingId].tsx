/**
 * Booking Detail Screen
 * Shows booking details with colored header, time reminder, unified info card,
 * useful actions (calendar, call, directions), and discrete cancel option
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { bookingService } from '@booking-app/firebase';
import type { Booking } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../../theme';
import { Text, Card, Button, useToast } from '../../../components';
import { useAuth } from '../../../contexts';

// Get API URL from environment
const API_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000';

// Helper to convert booking datetime to Date
function toDate(datetime: Date | any): Date {
  if (datetime instanceof Date) return datetime;
  if (datetime?.toDate) return datetime.toDate();
  return new Date(datetime);
}

// Helper to format date
function formatDate(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Helper to format time
function formatTime(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to format duration
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}

// Helper to format price
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

// Status configuration with header colors
interface StatusConfig {
  label: string;
  textColor: string;
  bgColor: string;
  headerBgLight: string;
  headerBgDark: string;
}

function getStatusConfig(status: string, isDark: boolean): StatusConfig {
  const configs: Record<string, StatusConfig> = {
    confirmed: {
      label: 'Confirme',
      textColor: '#16a34a',
      bgColor: '#dcfce7',
      headerBgLight: '#dcfce7',
      headerBgDark: 'rgba(22, 163, 74, 0.2)',
    },
    pending: {
      label: 'En attente',
      textColor: '#ca8a04',
      bgColor: '#fef9c3',
      headerBgLight: '#fef9c3',
      headerBgDark: 'rgba(202, 138, 4, 0.2)',
    },
    cancelled: {
      label: 'Annule',
      textColor: '#dc2626',
      bgColor: '#fee2e2',
      headerBgLight: '#fee2e2',
      headerBgDark: 'rgba(220, 38, 38, 0.2)',
    },
    noshow: {
      label: 'Absent',
      textColor: '#6b7280',
      bgColor: '#f3f4f6',
      headerBgLight: '#f3f4f6',
      headerBgDark: 'rgba(107, 114, 128, 0.2)',
    },
    past: {
      label: 'Termine',
      textColor: '#6b7280',
      bgColor: '#f3f4f6',
      headerBgLight: '#f3f4f6',
      headerBgDark: 'rgba(107, 114, 128, 0.2)',
    },
  };

  return configs[status] || configs.past;
}

// Get visual status based on time and booking status
function getVisualStatus(booking: WithId<Booking>): string {
  const now = new Date();
  const startTime = toDate(booking.datetime);
  const endTime = toDate(booking.endDatetime);

  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'noshow') return 'noshow';
  if (now >= startTime && now <= endTime) return 'ongoing';
  if (now > endTime) return 'past';
  if (booking.status === 'pending') return 'pending';
  return 'confirmed';
}

// Time reminder configuration
interface TimeReminder {
  text: string;
  color: string;
}

function getTimeReminder(booking: WithId<Booking>, colors: any): TimeReminder {
  const now = new Date();
  const startTime = toDate(booking.datetime);
  const endTime = toDate(booking.endDatetime);

  // Already cancelled or no-show
  if (booking.status === 'cancelled') {
    return { text: 'Annule', color: colors.error };
  }
  if (booking.status === 'noshow') {
    return { text: 'Absent', color: colors.error };
  }

  // Ongoing
  if (now >= startTime && now <= endTime) {
    return { text: 'En cours', color: colors.primary };
  }

  // Past
  if (now > endTime) {
    const diffMs = now.getTime() - endTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      if (diffHours < 1) {
        return { text: 'Termine il y a moins d\'une heure', color: colors.textSecondary };
      }
      return { text: `Termine il y a ${diffHours}h`, color: colors.textSecondary };
    }
    if (diffDays === 1) {
      return { text: 'Termine hier', color: colors.textSecondary };
    }
    return { text: `Termine il y a ${diffDays} jours`, color: colors.textSecondary };
  }

  // Future
  const diffMs = startTime.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Same day, less than 2 hours
  if (diffHours < 2) {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours > 0) {
      return { text: `Dans ${hours}h ${mins}min`, color: '#f97316' }; // Orange
    }
    return { text: `Dans ${mins} min`, color: '#f97316' };
  }

  // Same day
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bookingDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());

  if (nowDate.getTime() === bookingDate.getTime()) {
    return { text: 'Aujourd\'hui', color: '#16a34a' }; // Green
  }

  // Tomorrow
  const tomorrow = new Date(nowDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getTime() === bookingDate.getTime()) {
    return { text: 'Demain', color: colors.primary };
  }

  // Within 7 days
  if (diffDays <= 7) {
    return { text: `Dans ${diffDays} jours`, color: colors.primary };
  }

  // More than 7 days
  return { text: `Dans ${diffDays} jours`, color: colors.textSecondary };
}

// Check if booking can be cancelled
function canCancelBooking(booking: WithId<Booking>): boolean {
  if (!['pending', 'confirmed'].includes(booking.status)) {
    return false;
  }
  const bookingDate = toDate(booking.datetime);
  return bookingDate > new Date();
}

// Open maps with address
function openMaps(address: string) {
  const encodedAddress = encodeURIComponent(address);
  // Use universal Google Maps URL that works on both platforms
  const url = `https://maps.google.com/?q=${encodedAddress}`;
  Linking.openURL(url).catch((err) => {
    console.error('Error opening maps:', err);
    Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application de navigation');
  });
}

// Open phone dialer
function openPhone(phoneNumber: string) {
  const url = `tel:${phoneNumber}`;
  Linking.openURL(url).catch((err) => {
    console.error('Error opening phone:', err);
    Alert.alert('Erreur', 'Impossible d\'ouvrir le telephone');
  });
}

// Action row component
function ActionRow({
  icon,
  label,
  onPress,
  colors,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: any;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionRow,
        {
          opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

// Info row component for unified card
function InfoRow({
  icon,
  label,
  value,
  colors,
  onPress,
  linkText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: any;
  onPress?: () => void;
  linkText?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.surfaceSecondary }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        <Text variant="body" style={{ marginTop: 2, fontWeight: '600' }}>
          {value}
        </Text>
        {onPress && linkText && (
          <Pressable onPress={onPress} style={{ marginTop: 4 }}>
            <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
              {linkText}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<WithId<Booking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Load booking
  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setError('ID de reservation manquant');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bookingService.getById(bookingId);
      if (!result) {
        setError('Reservation non trouvee');
      } else {
        setBooking(result);
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  // Add to calendar
  const handleAddToCalendar = async () => {
    if (!booking) return;

    try {
      // Request calendar permission
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'acces au calendrier est necessaire pour ajouter l\'evenement');
        return;
      }

      // Get default calendar
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (cal) => cal.allowsModifications && (cal.isPrimary || cal.source?.name === 'Default')
      ) || calendars.find((cal) => cal.allowsModifications);

      if (!defaultCalendar) {
        Alert.alert('Erreur', 'Aucun calendrier disponible');
        return;
      }

      const startDate = toDate(booking.datetime);
      const endDate = toDate(booking.endDatetime);

      // Create event
      await Calendar.createEventAsync(defaultCalendar.id, {
        title: booking.serviceName,
        startDate,
        endDate,
        location: booking.locationAddress || booking.locationName || '',
        notes: `Prestataire: ${booking.providerName}${booking.memberName ? `\nAvec: ${booking.memberName}` : ''}`,
        timeZone: 'Europe/Paris',
      });

      showToast({
        variant: 'success',
        message: 'Ajoute au calendrier',
      });
    } catch (err: any) {
      console.error('Error adding to calendar:', err);
      Alert.alert('Erreur', 'Impossible d\'ajouter au calendrier');
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!booking || !user?.uid) return;

    setIsCancelling(true);

    try {
      await bookingService.cancelBooking(
        booking.id,
        'client',
        user.uid,
        cancelReason.trim() || undefined
      );

      // Send cancellation email (non-blocking, fire and forget)
      // Note: In development, localhost won't work from mobile device
      // Use your machine's IP address or deployed URL in .env.local
      if (API_URL && !API_URL.includes('localhost')) {
        fetch(`${API_URL}/api/bookings/cancel-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking.id,
            clientEmail: booking.clientInfo.email,
            clientName: booking.clientInfo.name,
            serviceName: booking.serviceName,
            datetime: booking.datetime,
            reason: cancelReason.trim() || undefined,
            providerName: booking.providerName,
            locationName: booking.locationName,
          }),
        }).catch(() => {
          // Silently ignore email errors - cancellation already succeeded
        });
      }

      showToast({
        variant: 'success',
        message: 'Rendez-vous annule',
      });

      setShowCancelModal(false);
      router.back();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      showToast({
        variant: 'error',
        message: err.message || 'Erreur lors de l\'annulation',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Error state
  if (error || !booking) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.errorHeader, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text variant="body" color="error" style={{ marginTop: spacing.md, textAlign: 'center' }}>
            {error || 'Reservation non trouvee'}
          </Text>
          <Button
            variant="outline"
            title="Retour"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </View>
    );
  }

  const visualStatus = getVisualStatus(booking);
  const statusConfig = getStatusConfig(visualStatus, isDark);
  const timeReminder = getTimeReminder(booking, colors);
  const canCancel = canCancelBooking(booking);
  const hasAddress = !!(booking.locationAddress || booking.locationName);
  const hasPhone = !!(booking as any).providerPhone; // Assuming providerPhone might exist

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Blue Header */}
        <View
          style={[
            styles.coloredHeader,
            {
              backgroundColor: colors.primary,
              marginTop: insets.top,
              marginHorizontal: spacing.md,
              paddingTop: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              borderRadius: 16,
            },
          ]}
        >
          {/* Top row: Back button + Status badge */}
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: radius.full,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </Pressable>

            {/* Status badge on the right */}
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Ionicons
                name={
                  visualStatus === 'confirmed' ? 'checkmark-circle' :
                  visualStatus === 'pending' ? 'time' :
                  visualStatus === 'cancelled' ? 'close-circle' :
                  visualStatus === 'ongoing' ? 'play-circle' :
                  'checkmark-done-circle'
                }
                size={14}
                color={statusConfig.textColor}
              />
              <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Service name */}
          <Text variant="h2" style={[styles.serviceName, { color: '#ffffff' }]}>
            {booking.serviceName}
          </Text>

          {/* Price and duration */}
          <View style={styles.priceRow}>
            <Text variant="h3" style={{ fontWeight: '700', color: '#ffffff' }}>
              {formatPrice(booking.price)}
            </Text>
            <Text variant="body" style={{ marginLeft: spacing.sm, color: 'rgba(255,255,255,0.8)' }}>
              {formatDuration(booking.duration)}
            </Text>
          </View>
        </View>

        {/* Time Reminder */}
        <View style={[styles.timeReminderContainer, { marginHorizontal: spacing.lg, marginTop: spacing.lg }]}>
          <Ionicons name="time-outline" size={18} color={timeReminder.color} />
          <Text variant="body" style={{ marginLeft: spacing.xs, color: timeReminder.color, fontWeight: '500' }}>
            {timeReminder.text}
          </Text>
        </View>

        {/* Unified Info Card */}
        <Card padding="lg" shadow="sm" style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
          {/* When */}
          <View style={{ gap: spacing.md }}>
            <InfoRow
              icon="calendar-outline"
              label="Date"
              value={formatDate(booking.datetime)}
              colors={colors}
            />
            <InfoRow
              icon="time-outline"
              label="Heure"
              value={`${formatTime(booking.datetime)} - ${formatTime(booking.endDatetime)}`}
              colors={colors}
            />
          </View>

          {/* Separator */}
          <View style={[styles.separator, { backgroundColor: colors.border, marginVertical: spacing.lg }]} />

          {/* Where and with whom */}
          <View style={{ gap: spacing.md }}>
            <InfoRow
              icon="business-outline"
              label="Prestataire"
              value={booking.providerName}
              colors={colors}
            />
            {booking.memberName && (
              <InfoRow
                icon="person-outline"
                label="Avec"
                value={booking.memberName}
                colors={colors}
              />
            )}
            {hasAddress && (
              <InfoRow
                icon="location-outline"
                label="Lieu"
                value={booking.locationAddress || booking.locationName || ''}
                colors={colors}
                onPress={() => openMaps(booking.locationAddress || booking.locationName || '')}
                linkText="Voir sur le plan"
              />
            )}
          </View>
        </Card>

        {/* Actions Card */}
        <Card padding="md" shadow="sm" style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
          <ActionRow
            icon="calendar-outline"
            label="Ajouter au calendrier"
            onPress={handleAddToCalendar}
            colors={colors}
          />
          {hasPhone && (
            <ActionRow
              icon="call-outline"
              label="Appeler"
              onPress={() => openPhone((booking as any).providerPhone)}
              colors={colors}
            />
          )}
          {hasAddress && (
            <ActionRow
              icon="navigate-outline"
              label="Itineraire"
              onPress={() => openMaps(booking.locationAddress || booking.locationName || '')}
              colors={colors}
            />
          )}
        </Card>

        {/* Cancel Button */}
        {canCancel && (
          <Pressable
            onPress={() => setShowCancelModal(true)}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                marginTop: spacing.lg,
                marginHorizontal: spacing.lg,
                backgroundColor: pressed ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
                borderColor: colors.error,
              },
            ]}
          >
            <Ionicons name="close-circle-outline" size={20} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 15, fontWeight: '500', marginLeft: 8 }}>
              Annuler le rendez-vous
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Cancel Confirmation Modal */}
      <Modal
        visible={showCancelModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
            <View style={[styles.modalIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="warning-outline" size={32} color="#dc2626" />
            </View>

            <Text variant="h3" style={{ textAlign: 'center', marginTop: spacing.md }}>
              Annuler le rendez-vous ?
            </Text>

            <Text variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
              Cette action est irreversible. Le prestataire sera notifie de l'annulation.
            </Text>

            {/* Reason input */}
            <View style={{ marginTop: spacing.lg }}>
              <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                Raison (optionnel)
              </Text>
              <TextInput
                style={[
                  styles.reasonInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                    borderRadius: radius.md,
                  },
                ]}
                placeholder="Indiquez une raison..."
                placeholderTextColor={colors.textSecondary}
                value={cancelReason}
                onChangeText={setCancelReason}
                returnKeyType="done"
                blurOnSubmit={true}
              />
            </View>

            {/* Actions */}
            <View style={[styles.modalActions, { marginTop: spacing.xl }]}>
              <Button
                variant="outline"
                title="Retour"
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                title="Confirmer"
                onPress={handleCancel}
                loading={isCancelling}
                disabled={isCancelling}
                style={{ flex: 1, backgroundColor: colors.error }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coloredHeader: {
    // Dynamic styles applied inline
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: {
    marginTop: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeReminderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  separator: {
    height: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  errorHeader: {
    // Dynamic styles applied inline
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  reasonInput: {
    borderWidth: 1,
    padding: 12,
    height: 44,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
