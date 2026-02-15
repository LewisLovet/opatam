/**
 * Pro Booking Detail Screen
 * Shows full booking details with client info, service details, and action buttons
 * for providers to confirm, cancel, or mark no-show.
 * Redesigned with premium client card, icon-circle detail rows, and prominent actions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  Linking,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingService, schedulingService, memberService } from '@booking-app/firebase';
import type { Booking, Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  Button,
  Loader,
  Avatar,
  CalendarStrip,
  TimeSlotSection,
  EmptyState,
} from '../../../components';
import { BookingStatusBadge } from '../../../components/business';
import { useAuth, useProvider } from '../../../contexts';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------- Date formatting helpers ----------

const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function toDate(datetime: Date | any): Date {
  if (datetime instanceof Date) return datetime;
  if (datetime?.toDate) return datetime.toDate();
  return new Date(datetime);
}

function formatDateFr(datetime: Date | any): string {
  const date = toDate(datetime);
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${day} ${month} ${year}`;
}

function formatTime(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEndTime(datetime: Date | any, durationMinutes: number): string {
  const date = toDate(datetime);
  const endDate = new Date(date.getTime() + durationMinutes * 60 * 1000);
  return endDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

// ---------- Reschedule slot types & config ----------

type Period = 'morning' | 'afternoon' | 'evening';

interface SlotWithMember {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
  memberId: string;
}

const PERIODS_CONFIG: {
  key: Period;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  accentColor: string;
}[] = [
  { key: 'morning', label: 'Matin', icon: 'sunny', backgroundColor: '#FEF3C7', accentColor: '#D97706' },
  { key: 'afternoon', label: 'Après-midi', icon: 'partly-sunny', backgroundColor: '#FFEDD5', accentColor: '#EA580C' },
  { key: 'evening', label: 'Soir', icon: 'moon', backgroundColor: '#E0E7FF', accentColor: '#4F46E5' },
];

function getHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

// ---------- Detail row component (redesigned with icon circles) ----------

function DetailRow({
  icon,
  label,
  value,
  valueColor,
  valueWeight,
  colors,
  spacing,
  radius,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  valueWeight?: '400' | '500' | '600' | '700';
  colors: any;
  spacing: any;
  radius: any;
  isLast?: boolean;
}) {
  return (
    <View>
      <View style={detailRowStyles.row}>
        <View
          style={[
            detailRowStyles.iconCircle,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={detailRowStyles.textContainer}>
          <Text variant="caption" color="textSecondary">
            {label}
          </Text>
          <Text
            variant="body"
            style={{
              fontWeight: valueWeight || '600',
              marginTop: 2,
              color: valueColor || colors.text,
            }}
          >
            {value}
          </Text>
        </View>
      </View>
      {!isLast && (
        <View
          style={[
            detailRowStyles.separator,
            {
              backgroundColor: colors.divider,
              marginLeft: 52,
              marginVertical: spacing.sm,
            },
          ]}
        />
      )}
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  iconCircle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  separator: {
    height: 1,
  },
});

// ---------- Contact pill component ----------

function ContactPill({
  icon,
  text,
  onPress,
  onCopy,
  colors,
  radius,
  spacing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
  onCopy: () => void;
  colors: any;
  radius: any;
  spacing: any;
}) {
  return (
    <View style={contactPillStyles.pillRow}>
      <Pressable
        onPress={onPress}
        hitSlop={4}
        style={({ pressed }) => [
          contactPillStyles.pill,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.full,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={14} color={colors.primary} style={{ marginRight: 6 }} />
        <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
          {text}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            contactPillStyles.copyButton,
            {
              marginLeft: spacing.sm,
              opacity: pressed ? 0.5 : 1,
              backgroundColor: pressed ? colors.primaryLight : 'transparent',
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const contactPillStyles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  copyButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------- Main screen ----------

export default function ProBookingDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { providerId } = useProvider();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [booking, setBooking] = useState<WithId<Booking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load booking data
  const loadBooking = useCallback(async () => {
    if (!id) {
      setError('ID de rendez-vous manquant');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bookingService.getById(id);
      if (!result) {
        setError('Rendez-vous non trouvé');
      } else {
        setBooking(result);
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  // ---------- Actions ----------

  const handleConfirm = useCallback(async () => {
    if (!booking || !user?.uid) return;

    Alert.alert(
      'Confirmer le rendez-vous',
      'Voulez-vous confirmer ce rendez-vous ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, confirmer',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.confirmBooking(booking.id, user.uid);
              await loadBooking();
            } catch (err: any) {
              console.error('Error confirming booking:', err);
              Alert.alert('Erreur', err.message || 'Impossible de confirmer le rendez-vous');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  const handleCancel = useCallback(async () => {
    if (!booking || !user?.uid) return;

    Alert.alert(
      'Annuler le rendez-vous',
      'Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action est irréversible.',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.cancelBooking(booking.id, 'provider', user.uid);
              await loadBooking();
            } catch (err: any) {
              console.error('Error cancelling booking:', err);
              Alert.alert('Erreur', err.message || 'Impossible d\'annuler le rendez-vous');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  const handleMarkNoShow = useCallback(async () => {
    if (!booking || !user?.uid) return;

    Alert.alert(
      'Marquer comme absent',
      'Voulez-vous marquer ce client comme absent ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, marquer absent',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.markNoShow(booking.id, user.uid);
              await loadBooking();
            } catch (err: any) {
              console.error('Error marking no-show:', err);
              Alert.alert('Erreur', err.message || 'Impossible de marquer comme absent');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  // -- Reschedule state (slot-based flow) --
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotWithMember[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<SlotWithMember | null>(null);
  const [rescheduleMembers, setRescheduleMembers] = useState<WithId<Member>[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });

  // Load members when modal opens
  useEffect(() => {
    if (!showRescheduleModal || !providerId) return;
    memberService
      .getByProvider(providerId)
      .then((result) => setRescheduleMembers((result as WithId<Member>[]).filter((m) => m.isActive)))
      .catch(() => setRescheduleMembers([]));
  }, [showRescheduleModal, providerId]);

  // Load available slots when date changes in reschedule modal
  useEffect(() => {
    if (!showRescheduleModal || !booking || !providerId) return;

    const loadSlots = async () => {
      setLoadingSlots(true);
      setSelectedRescheduleSlot(null);

      try {
        const activeMembers = rescheduleMembers.filter((m) => m.isActive);
        const allSlots: SlotWithMember[] = [];

        const promises = activeMembers.map(async (member) => {
          try {
            const memberSlots = await schedulingService.getAvailableSlots({
              providerId,
              serviceId: booking.serviceId,
              memberId: member.id,
              startDate: rescheduleDate,
              endDate: rescheduleDate,
            });
            return memberSlots.map((slot) => ({ ...slot, memberId: member.id }));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(promises);
        for (const memberSlots of results) {
          allSlots.push(...memberSlots);
        }

        allSlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

        // Deduplicate
        const seen = new Set<string>();
        const uniqueSlots = allSlots.filter((slot) => {
          const key = `${slot.datetime.getTime()}-${slot.memberId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRescheduleSlots(uniqueSlots);
        setExpandedSections({ morning: false, afternoon: false, evening: false });
      } catch {
        setRescheduleSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    if (rescheduleMembers.length > 0) {
      loadSlots();
    }
  }, [showRescheduleModal, rescheduleDate, booking, providerId, rescheduleMembers]);

  // Group slots by period
  const groupedRescheduleSlots = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    const seen = new Set<string>();

    for (const slot of rescheduleSlots) {
      if (seen.has(slot.start)) continue;
      seen.add(slot.start);
      const hour = getHour(slot.start);
      if (hour < 12) morning.push(slot.start);
      else if (hour < 17) afternoon.push(slot.start);
      else evening.push(slot.start);
    }
    return { morning, afternoon, evening };
  }, [rescheduleSlots]);

  // Map time string to slot
  const rescheduleSlotByTime = useMemo(() => {
    const map = new Map<string, SlotWithMember>();
    for (const slot of rescheduleSlots) {
      if (!map.has(slot.start)) map.set(slot.start, slot);
    }
    return map;
  }, [rescheduleSlots]);

  const handleReschedule = useCallback(() => {
    if (!booking) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setRescheduleDate(today);
    setSelectedRescheduleSlot(null);
    setRescheduleSlots([]);
    setShowRescheduleModal(true);
  }, [booking]);

  const handleSelectRescheduleSlot = useCallback((time: string) => {
    const slot = rescheduleSlotByTime.get(time);
    if (slot) setSelectedRescheduleSlot(slot);
  }, [rescheduleSlotByTime]);

  const handleRescheduleDateChange = useCallback((date: Date) => {
    setRescheduleDate(date);
    setSelectedRescheduleSlot(null);
  }, []);

  const toggleRescheduleSection = useCallback((period: Period) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => ({ ...prev, [period]: !prev[period] }));
  }, []);

  const handleRescheduleConfirm = useCallback(async () => {
    if (!booking || !user?.uid || !selectedRescheduleSlot) return;

    const newDatetime = selectedRescheduleSlot.datetime;
    setShowRescheduleModal(false);

    Alert.alert(
      'Modifier l\'horaire',
      `Reprogrammer au ${formatDateFr(newDatetime)} à ${formatTime(newDatetime)} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.rescheduleBooking(booking.id, newDatetime, user.uid);
              await loadBooking();
              Alert.alert('Succès', 'L\'horaire a été modifié avec succès.');
            } catch (err: any) {
              Alert.alert('Erreur', err.message || 'Impossible de modifier l\'horaire');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, selectedRescheduleSlot, loadBooking]);

  const handleCallClient = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le téléphone');
    });
  }, []);

  const handleEmailClient = useCallback((email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application mail');
    });
  }, []);

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      // Fallback: noop
    }
    Alert.alert('Copié', `"${text}" copié dans le presse-papier.`);
  }, []);

  // ---------- Loading state ----------

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Error state ----------

  if (error || !booking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1, marginLeft: spacing.md }}>
            Détail
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text
            variant="body"
            color="error"
            style={{ marginTop: spacing.md, textAlign: 'center' }}
          >
            {error || 'Rendez-vous non trouvé'}
          </Text>
          <Button
            variant="outline"
            title="Retour"
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Derived values ----------

  const bookingDate = toDate(booking.datetime);
  const isPast = bookingDate < new Date();

  // Build detail rows
  const detailRows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    valueColor?: string;
    valueWeight?: '400' | '500' | '600' | '700';
  }[] = [
    { icon: 'cut-outline', label: 'Prestation', value: booking.serviceName },
    { icon: 'calendar-outline', label: 'Date', value: formatDateFr(booking.datetime) },
    {
      icon: 'time-outline',
      label: 'Horaire',
      value: `${formatTime(booking.datetime)} - ${formatEndTime(booking.datetime, booking.duration)}`,
    },
    { icon: 'hourglass-outline', label: 'Durée', value: `${booking.duration} min` },
    {
      icon: 'pricetag-outline',
      label: 'Prix',
      value: formatPrice(booking.price),
      valueColor: colors.primary,
      valueWeight: '700' as const,
    },
  ];

  if (booking.locationName) {
    detailRows.push({
      icon: 'location-outline',
      label: 'Lieu',
      value: booking.locationAddress || booking.locationName,
    });
  }

  if (booking.memberName) {
    detailRows.push({
      icon: 'person-outline',
      label: 'Membre',
      value: booking.memberName,
    });
  }

  if ((booking as any).notes) {
    detailRows.push({
      icon: 'document-text-outline',
      label: 'Notes',
      value: (booking as any).notes,
    });
  }

  // ---------- Render ----------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1, marginLeft: spacing.md }}>
            Détail
          </Text>
        </View>

        {/* Status badge - large and centered */}
        <View style={[styles.statusContainer, { marginVertical: spacing.md }]}>
          <View style={{ alignSelf: 'center' }}>
            <BookingStatusBadge status={booking.status} size="md" />
          </View>
        </View>

        {/* Client info card - premium feel */}
        <Card
          padding="lg"
          shadow="sm"
          style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}
        >
          {/* Centered avatar */}
          <View style={styles.clientCardContent}>
            <Avatar size="xl" name={booking.clientInfo.name} />
            <Text
              variant="h2"
              style={{ marginTop: spacing.sm, textAlign: 'center' }}
            >
              {booking.clientInfo.name}
            </Text>

            {/* Contact pills row */}
            <View style={[styles.contactRow, { marginTop: spacing.md, gap: spacing.sm }]}>
              {booking.clientInfo.phone ? (
                <ContactPill
                  icon="call-outline"
                  text={booking.clientInfo.phone}
                  onPress={() => handleCallClient(booking.clientInfo.phone)}
                  onCopy={() => handleCopyToClipboard(booking.clientInfo.phone)}
                  colors={colors}
                  radius={radius}
                  spacing={spacing}
                />
              ) : null}
              {booking.clientInfo.email ? (
                <ContactPill
                  icon="mail-outline"
                  text={booking.clientInfo.email}
                  onPress={() => handleEmailClient(booking.clientInfo.email)}
                  onCopy={() => handleCopyToClipboard(booking.clientInfo.email)}
                  colors={colors}
                  radius={radius}
                  spacing={spacing}
                />
              ) : null}
            </View>
          </View>
        </Card>

        {/* Booking details card - clean info rows */}
        <Card
          padding="lg"
          shadow="sm"
          style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}
        >
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.md,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
            }}
          >
            Détails du rendez-vous
          </Text>
          <View>
            {detailRows.map((row, index) => (
              <DetailRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                value={row.value}
                valueColor={row.valueColor}
                valueWeight={row.valueWeight}
                colors={colors}
                spacing={spacing}
                radius={radius}
                isLast={index === detailRows.length - 1}
              />
            ))}
          </View>
        </Card>

        {/* Action buttons - clear and prominent */}
        {booking.status === 'pending' && (
          <View
            style={[
              styles.actionsContainer,
              {
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            <View style={[styles.actionsRow, { gap: spacing.sm }]}>
              <Button
                title="Confirmer"
                variant="primary"
                onPress={handleConfirm}
                disabled={actionLoading}
                loading={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                }
                style={{ flex: 1 }}
              />
              <Button
                title="Annuler"
                variant="outline"
                onPress={handleCancel}
                disabled={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="close" size={18} color={colors.primary} />
                }
                style={{
                  flex: 1,
                  borderColor: colors.error,
                }}
              />
            </View>
            <Button
              title="Modifier l'horaire"
              variant="outline"
              onPress={handleReschedule}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              }
            />
          </View>
        )}

        {booking.status === 'confirmed' && (
          <View
            style={[
              styles.actionsContainer,
              {
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            <Button
              title="Modifier l'horaire"
              variant="outline"
              onPress={handleReschedule}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              }
            />
            {isPast && (
              <Button
                title="Marquer absent"
                variant="outline"
                onPress={handleMarkNoShow}
                disabled={actionLoading}
                loading={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                }
                style={{ borderColor: colors.warning }}
              />
            )}
            <Button
              title="Annuler le RDV"
              variant="outline"
              onPress={handleCancel}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              }
              style={{ borderColor: colors.error }}
            />
          </View>
        )}
      </ScrollView>

      {/* ===== Reschedule Modal (full-screen with available slots) ===== */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <SafeAreaView style={[rescheduleStyles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View
            style={[
              rescheduleStyles.header,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
              },
            ]}
          >
            <Pressable onPress={() => setShowRescheduleModal(false)}>
              <Text variant="body" color="textSecondary">
                Fermer
              </Text>
            </Pressable>
            <Text variant="body" style={{ fontWeight: '600' }}>
              Modifier l'horaire
            </Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Calendar strip */}
          <View style={{ paddingVertical: spacing.md }}>
            <CalendarStrip
              selectedDate={rescheduleDate}
              onSelectDate={handleRescheduleDateChange}
            />
          </View>

          {/* Available slots */}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing['3xl'],
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              Horaires disponibles
            </Text>

            {loadingSlots ? (
              <Card padding="lg" shadow="sm">
                <View style={rescheduleStyles.loaderContainer}>
                  <Loader />
                  <Text
                    variant="body"
                    color="textSecondary"
                    style={{ marginTop: spacing.md }}
                  >
                    Chargement des créneaux...
                  </Text>
                </View>
              </Card>
            ) : rescheduleSlots.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="Aucun créneau disponible"
                description="Aucun créneau n'est disponible pour cette date. Essayez une autre date."
              />
            ) : (
              <View>
                {PERIODS_CONFIG.map((period) => (
                  <TimeSlotSection
                    key={period.key}
                    title={period.label}
                    icon={period.icon}
                    backgroundColor={period.backgroundColor}
                    accentColor={period.accentColor}
                    slots={groupedRescheduleSlots[period.key]}
                    isExpanded={expandedSections[period.key]}
                    onToggle={() => toggleRescheduleSection(period.key)}
                    selectedSlot={selectedRescheduleSlot?.start || null}
                    onSelectSlot={handleSelectRescheduleSlot}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* Fixed bottom confirm button */}
          {selectedRescheduleSlot && (
            <View
              style={[
                rescheduleStyles.bottomBar,
                {
                  padding: spacing.lg,
                  paddingBottom: spacing.xl,
                  backgroundColor: colors.background,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                },
              ]}
            >
              <Button
                title={`Confirmer — ${selectedRescheduleSlot.start}`}
                variant="primary"
                size="lg"
                onPress={handleRescheduleConfirm}
                fullWidth
                leftIcon={
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={colors.textInverse}
                  />
                }
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  clientCardContent: {
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  actionsContainer: {},
  actionsRow: {
    flexDirection: 'row',
  },
});

const rescheduleStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  bottomBar: {},
});
