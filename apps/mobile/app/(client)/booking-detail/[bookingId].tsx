/**
 * Booking Detail Screen
 * Shows booking details with colored header, time reminder, unified info card,
 * useful actions (calendar, call, directions), and discrete cancel option
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../../lib/config';
import i18n from '../../../lib/i18n';
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
import { bookingService, reviewService, providerService } from '@booking-app/firebase';
import type { Booking } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../../theme';
import { Text, Card, Button, Avatar, useToast } from '../../../components';
import { KeyboardAvoidingSheet } from '../../../components/KeyboardAvoidingSheet';
import { useAuth } from '../../../contexts';

// Helper to convert booking datetime to Date
function toDate(datetime: Date | any): Date {
  if (datetime instanceof Date) return datetime;
  if (datetime?.toDate) return datetime.toDate();
  return new Date(datetime);
}

// Locale for date/number formatting, following the current app language
function dateLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR';
}

// Helper to format date
function formatDate(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleDateString(dateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Helper to format time
function formatTime(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleTimeString(dateLocale(), {
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
function formatPrice(cents: number, centsMax?: number | null): string {
  if (cents === 0 && !centsMax) return i18n.t('common.free');
  const fmt = (v: number) =>
    new Intl.NumberFormat(dateLocale(), { style: 'currency', currency: 'EUR' }).format(v / 100);
  if (centsMax && centsMax > cents) {
    return i18n.t('bookingDetailScreen.priceRange', { min: fmt(cents), max: fmt(centsMax) });
  }
  return fmt(cents);
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
      label: i18n.t('bookingDetailScreen.status.confirmed'),
      textColor: '#16a34a',
      bgColor: '#dcfce7',
      headerBgLight: '#dcfce7',
      headerBgDark: 'rgba(22, 163, 74, 0.2)',
    },
    pending: {
      label: i18n.t('bookingDetailScreen.status.pending'),
      textColor: '#ca8a04',
      bgColor: '#fef9c3',
      headerBgLight: '#fef9c3',
      headerBgDark: 'rgba(202, 138, 4, 0.2)',
    },
    cancelled: {
      label: i18n.t('bookingDetailScreen.status.cancelled'),
      textColor: '#dc2626',
      bgColor: '#fee2e2',
      headerBgLight: '#fee2e2',
      headerBgDark: 'rgba(220, 38, 38, 0.2)',
    },
    noshow: {
      label: i18n.t('bookingDetailScreen.status.noshow'),
      textColor: '#6b7280',
      bgColor: '#f3f4f6',
      headerBgLight: '#f3f4f6',
      headerBgDark: 'rgba(107, 114, 128, 0.2)',
    },
    past: {
      label: i18n.t('bookingDetailScreen.status.past'),
      textColor: '#16a34a',
      bgColor: '#dcfce7',
      headerBgLight: '#dcfce7',
      headerBgDark: 'rgba(22, 163, 74, 0.2)',
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
    return { text: i18n.t('bookingDetailScreen.reminder.cancelled'), color: colors.error };
  }
  if (booking.status === 'noshow') {
    return { text: i18n.t('bookingDetailScreen.reminder.noshow'), color: colors.error };
  }

  // Ongoing
  if (now >= startTime && now <= endTime) {
    return { text: i18n.t('bookingDetailScreen.reminder.ongoing'), color: colors.primary };
  }

  // Past
  if (now > endTime) {
    const diffMs = now.getTime() - endTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      if (diffHours < 1) {
        return { text: i18n.t('bookingDetailScreen.reminder.endedLessThanHour'), color: colors.textSecondary };
      }
      return { text: i18n.t('bookingDetailScreen.reminder.endedHoursAgo', { count: diffHours }), color: colors.textSecondary };
    }
    if (diffDays === 1) {
      return { text: i18n.t('bookingDetailScreen.reminder.endedYesterday'), color: colors.textSecondary };
    }
    return { text: i18n.t('bookingDetailScreen.reminder.endedDaysAgo', { count: diffDays }), color: colors.textSecondary };
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
      return { text: i18n.t('bookingDetailScreen.reminder.inHoursMinutes', { hours, minutes: mins }), color: '#f97316' }; // Orange
    }
    return { text: i18n.t('bookingDetailScreen.reminder.inMinutes', { count: mins }), color: '#f97316' };
  }

  // Same day
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bookingDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());

  if (nowDate.getTime() === bookingDate.getTime()) {
    return { text: i18n.t('bookingDetailScreen.reminder.today'), color: '#16a34a' }; // Green
  }

  // Tomorrow
  const tomorrow = new Date(nowDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getTime() === bookingDate.getTime()) {
    return { text: i18n.t('bookingDetailScreen.reminder.tomorrow'), color: colors.primary };
  }

  // Within 7 days
  if (diffDays <= 7) {
    return { text: i18n.t('bookingDetailScreen.reminder.inDays', { count: diffDays }), color: colors.primary };
  }

  // More than 7 days
  return { text: i18n.t('bookingDetailScreen.reminder.inDays', { count: diffDays }), color: colors.textSecondary };
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
    Alert.alert(
      i18n.t('bookingDetailScreen.alerts.errorTitle'),
      i18n.t('bookingDetailScreen.alerts.cannotOpenMaps')
    );
  });
}

// Open phone dialer
function openPhone(phoneNumber: string) {
  const url = `tel:${phoneNumber}`;
  Linking.openURL(url).catch((err) => {
    console.error('Error opening phone:', err);
    Alert.alert(
      i18n.t('bookingDetailScreen.alerts.errorTitle'),
      i18n.t('bookingDetailScreen.alerts.cannotOpenPhone')
    );
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<WithId<Booking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Address-privacy: the exact address (+ access) is fetched from the gated
  // endpoint and only revealed when allowed (confirmed + ≤48h).
  const [addr, setAddr] = useState<{
    protected: boolean;
    revealed: boolean;
    address: string;
    accessInstructions: string | null;
  } | null>(null);

  // Review state
  const [reviewStatus, setReviewStatus] = useState<'can_review' | 'can_update' | false | null>(null);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Load booking
  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setError(i18n.t('bookingDetailScreen.errors.missingId'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bookingService.getById(bookingId);
      if (!result) {
        setError(i18n.t('bookingDetailScreen.errors.notFound'));
      } else {
        setBooking(result);
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError(err.message || i18n.t('bookingDetailScreen.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  // Resolve the (reveal-gated) address from the server.
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    fetch(`${API_URL}/api/bookings/${bookingId}/address`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && !d.error) setAddr(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // Check review status after booking loads
  useEffect(() => {
    async function checkReview() {
      if (!booking || !user?.uid) return;
      try {
        const result = await reviewService.canReview(user.uid, booking.id);
        setReviewStatus(result);
      } catch {
        setReviewStatus(false);
      }
    }
    checkReview();
  }, [booking, user?.uid]);

  // Add to calendar
  const handleAddToCalendar = async () => {
    if (!booking) return;

    try {
      // Request calendar permission
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('bookingDetailScreen.calendar.permissionTitle'),
          t('bookingDetailScreen.calendar.permissionMessage')
        );
        return;
      }

      // Get default calendar
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(
        (cal) => cal.allowsModifications && (cal.isPrimary || cal.source?.name === 'Default')
      ) || calendars.find((cal) => cal.allowsModifications);

      if (!defaultCalendar) {
        Alert.alert(
          t('bookingDetailScreen.alerts.errorTitle'),
          t('bookingDetailScreen.calendar.noCalendar')
        );
        return;
      }

      const startDate = toDate(booking.datetime);
      const endDate = toDate(booking.endDatetime);

      // Use the revealed exact address when available (protected + revealed,
      // or non-protected), else fall back to the masked snapshot.
      const calendarLocation =
        addr && (!addr.protected || addr.revealed) && addr.address
          ? addr.address
          : booking.locationAddress || booking.locationName || '';

      // Create event
      await Calendar.createEventAsync(defaultCalendar.id, {
        title: booking.serviceName,
        startDate,
        endDate,
        location: calendarLocation,
        notes: `${t('bookingDetailScreen.calendar.noteProvider', { name: booking.providerName })}${booking.memberName ? `\n${t('bookingDetailScreen.calendar.noteWith', { name: booking.memberName })}` : ''}`,
        timeZone: 'Europe/Paris',
      });

      showToast({
        variant: 'success',
        message: t('bookingDetailScreen.calendar.added'),
      });
    } catch (err: any) {
      console.error('Error adding to calendar:', err);
      Alert.alert(
        t('bookingDetailScreen.alerts.errorTitle'),
        t('bookingDetailScreen.calendar.addFailed')
      );
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

      // Cancellation emails are handled by the onBookingWrite Cloud Function

      showToast({
        variant: 'success',
        message: t('bookingDetailScreen.cancelFlow.success'),
      });

      setShowCancelModal(false);
      router.back();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      showToast({
        variant: 'error',
        message: err.message || t('bookingDetailScreen.cancelFlow.error'),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle rebook - navigate to provider page
  const handleRebook = async () => {
    if (!booking) return;
    try {
      const provider = await providerService.getById(booking.providerId);
      if (provider?.slug) {
        router.push(`/(client)/provider/${provider.slug}` as any);
      }
    } catch {
      showToast({ variant: 'error', message: t('bookingDetailScreen.errors.providerPageFailed') });
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
            {error || t('bookingDetailScreen.errors.notFound')}
          </Text>
          <Button
            variant="outline"
            title={t('common.back')}
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
  const hasStreetAddress = !!(booking.locationAddress && booking.locationAddress.includes(','));
  // Reveal-aware address (the gated endpoint overrides the masked snapshot).
  const addrText = addr?.address || booking.locationAddress || booking.locationName || '';
  const addrRevealed = addr ? !addr.protected || addr.revealed : hasStreetAddress;
  const addrPending = !!(addr?.protected && !addr.revealed);
  const addrRevealedProtected = !!(addr?.protected && addr.revealed);
  const addrHasMaps = addrRevealed && addrText.includes(',');
  const hasPhone = !!(booking as any).providerPhone; // Assuming providerPhone might exist
  const isPast = visualStatus === 'past';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Blue Header - extends behind status bar */}
        <View
          style={[
            styles.coloredHeader,
            {
              backgroundColor: colors.primary,
              paddingTop: insets.top + spacing.md,
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.lg,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
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

          {/* Provider logo + name */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Avatar size="md" name={booking.providerName} imageUrl={booking.providerPhoto} />
            <Text variant="body" style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {booking.providerName}
            </Text>
          </View>

          {/* Service name */}
          <Text variant="h2" style={[styles.serviceName, { color: '#ffffff' }]}>
            {booking.serviceName}
          </Text>

          {/* Price and duration */}
          <View style={styles.priceRow}>
            {booking.originalPrice != null && booking.originalPrice > booking.price && (
              <Text
                variant="body"
                style={{
                  textDecorationLine: 'line-through',
                  color: 'rgba(255,255,255,0.7)',
                  marginRight: spacing.xs,
                }}
              >
                {formatPrice(booking.originalPrice)}
              </Text>
            )}
            <Text variant="h3" style={{ fontWeight: '700', color: '#ffffff' }}>
              {formatPrice(booking.price, booking.priceMax)}
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
              label={t('bookingDetailScreen.info.date')}
              value={formatDate(booking.datetime)}
              colors={colors}
            />
            <InfoRow
              icon="time-outline"
              label={t('bookingDetailScreen.info.time')}
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
              label={t('bookingDetailScreen.info.provider')}
              value={booking.providerName}
              colors={colors}
            />
            {booking.memberName && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {booking.memberColor && (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: booking.memberColor,
                      marginRight: spacing.sm,
                    }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <InfoRow
                    icon="person-outline"
                    label={t('bookingDetailScreen.info.with')}
                    value={booking.memberName}
                    colors={colors}
                  />
                </View>
              </View>
            )}
            {hasAddress && (
              <InfoRow
                icon="location-outline"
                label={t('bookingDetailScreen.info.location')}
                value={addrText}
                colors={colors}
                onPress={addrHasMaps ? () => openMaps(addrText) : undefined}
                linkText={addrHasMaps ? t('bookingDetailScreen.info.viewOnMap') : undefined}
              />
            )}
            {addrRevealedProtected && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginTop: spacing.xs,
                }}
              >
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text variant="caption" style={{ color: '#16a34a', fontWeight: '600' }}>
                  {t('bookingDetailScreen.info.exactAddressAvailable')}
                </Text>
              </View>
            )}
            {addrPending && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.sm,
                  backgroundColor: colors.primaryLight || '#e4effa',
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.sm,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={colors.primary}
                  style={{ marginTop: 1 }}
                />
                <Text variant="caption" style={{ flex: 1, color: colors.primary, lineHeight: 18 }}>
                  {t('bookingDetailScreen.info.addressPending')}
                </Text>
              </View>
            )}
            {addr?.revealed && addr.accessInstructions ? (
              <InfoRow
                icon="key-outline"
                label={t('bookingDetailScreen.info.access')}
                value={addr.accessInstructions}
                colors={colors}
              />
            ) : null}
          </View>
        </Card>

        {/* Actions Card */}
        <Card padding="md" shadow="sm" style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
          {isPast && (
            <ActionRow
              icon="refresh-outline"
              label={t('bookingDetailScreen.actions.rebook')}
              onPress={handleRebook}
              colors={colors}
            />
          )}
          <ActionRow
            icon="calendar-outline"
            label={t('bookingDetailScreen.actions.addToCalendar')}
            onPress={handleAddToCalendar}
            colors={colors}
          />
          {hasPhone && (
            <ActionRow
              icon="call-outline"
              label={t('bookingDetailScreen.actions.call')}
              onPress={() => openPhone((booking as any).providerPhone)}
              colors={colors}
            />
          )}
          {addrHasMaps && (
            <ActionRow
              icon="navigate-outline"
              label={t('bookingDetailScreen.actions.directions')}
              onPress={() => openMaps(addrText)}
              colors={colors}
            />
          )}
        </Card>

        {/* Review Button */}
        {(reviewStatus === 'can_review' || reviewStatus === 'can_update') && (
          <Pressable
            onPress={() => router.push(`/(client)/review/${booking.id}` as any)}
            style={({ pressed }) => [
              styles.reviewButton,
              {
                marginTop: spacing.lg,
                marginHorizontal: spacing.lg,
                backgroundColor: pressed ? 'rgba(245, 158, 11, 0.1)' : colors.surface,
                borderColor: '#f59e0b',
                borderRadius: radius.md,
              },
            ]}
          >
            <Ionicons name="star" size={20} color="#f59e0b" />
            <Text style={{ color: '#f59e0b', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              {reviewStatus === 'can_update' ? t('bookingDetailScreen.review.update') : t('bookingDetailScreen.review.leave')}
            </Text>
          </Pressable>
        )}

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
              {t('bookingDetailScreen.cancelFlow.button')}
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
        <KeyboardAvoidingSheet style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
            <View style={[styles.modalIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="warning-outline" size={32} color="#dc2626" />
            </View>

            <Text variant="h3" style={{ textAlign: 'center', marginTop: spacing.md }}>
              {t('bookingDetailScreen.cancelFlow.modalTitle')}
            </Text>

            <Text variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
              {t('bookingDetailScreen.cancelFlow.modalMessage')}
            </Text>

            {/* Reason input */}
            <View style={{ marginTop: spacing.lg }}>
              <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                {t('bookingDetailScreen.cancelFlow.reasonLabel')}
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
                placeholder={t('bookingDetailScreen.cancelFlow.reasonPlaceholder')}
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
                title={t('common.back')}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                title={t('common.confirm')}
                onPress={handleCancel}
                loading={isCancelling}
                disabled={isCancelling}
                style={{ flex: 1, backgroundColor: colors.error }}
              />
            </View>
          </View>
        </KeyboardAvoidingSheet>
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
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
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
