/**
 * Booking Step 2: Date & Time Selection
 * Uses CalendarStrip for date selection and TimeSlotSection for grouped time slots
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme';
import { BookingStepHeader } from '../../../../components/business/BookingStepHeader';
import {
  Text,
  Card,
  EmptyState,
  MonthCalendar,
  BookingSummary,
  TimeSlotSection,
  StickyConfirmButton,
} from '../../../../components';
import { useBooking } from '../../../../contexts';
import { computeServiceTotal, computeDiscountedTotal } from '@booking-app/shared';
import { useAvailabilitySummary, type TimeSlot } from '../../../../hooks';

// Local YYYY-MM-DD — must match the server/summary key (not toISOString → UTC).
function dateKeyLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Period configuration
type Period = 'morning' | 'afternoon' | 'evening';

interface PeriodConfig {
  key: Period;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  accentColor: string;
}

const PERIODS_CONFIG: PeriodConfig[] = [
  {
    key: 'morning',
    label: 'Matin',
    icon: 'sunny',
    backgroundColor: '#FEF3C7', // Warm yellow bg
    accentColor: '#D97706',     // Amber accent
  },
  {
    key: 'afternoon',
    label: 'Après-midi',
    icon: 'partly-sunny',
    backgroundColor: '#FFEDD5', // Warm orange bg
    accentColor: '#EA580C',     // Orange accent
  },
  {
    key: 'evening',
    label: 'Soir',
    icon: 'moon',
    backgroundColor: '#E0E7FF', // Cool indigo bg
    accentColor: '#4F46E5',     // Indigo accent
  },
];

// Group slots by period
interface GroupedSlots {
  morning: string[];
  afternoon: string[];
  evening: string[];
}

function groupSlotsByPeriod(slots: TimeSlot[]): GroupedSlots {
  const grouped: GroupedSlots = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    const hour = parseInt(slot.start.split(':')[0], 10);
    if (hour >= 0 && hour < 12) {
      grouped.morning.push(slot.start);
    } else if (hour >= 12 && hour < 18) {
      grouped.afternoon.push(slot.start);
    } else {
      grouped.evening.push(slot.start);
    }
  }

  return grouped;
}

export default function DateSelectionScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();

  // Booking context
  const { provider, service, member, memberId, cart, setDateAndSlot } = useBooking();
  const globalDiscount = provider?.settings?.globalDiscount ?? null;

  // Whole-visit effective totals across the cart (variations chosen) — with the
  // active promo applied, so the summary price matches what the client pays.
  const cartPrice = cart.reduce(
    (sum, c) => sum + computeDiscountedTotal(c.service, c.selections, globalDiscount).price,
    0,
  );
  const cartDuration = cart.reduce(
    (sum, c) => sum + computeServiceTotal(c.service, c.selections).duration,
    0,
  );
  // Reserve the full visit length (sum of durations + the LAST service's buffer).
  const durationOverride =
    cart.length > 0
      ? cartDuration + (cart[cart.length - 1].service.bufferTime || 0)
      : undefined;

  // How far ahead clients can book (provider setting).
  const maxAdvanceDays = (provider as any)?.settings?.maxBookingAdvance ?? 60;

  const summaryRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + maxAdvanceDays);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [maxAdvanceDays]);

  // ONE batched call for the whole range: per-day status + capacity + slots.
  const { summary, loading, error } = useAvailabilitySummary({
    providerId,
    serviceId: service?.id ?? undefined,
    memberId: memberId ?? undefined,
    startDate: summaryRange.start,
    endDate: summaryRange.end,
    durationOverride,
  });

  // No day pre-selected — the client picks one from the full month calendar.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Expanded sections state - all collapsed by default
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });

  const selectedInfo = selectedDate ? summary[dateKeyLocal(selectedDate)] : undefined;
  const slots = selectedInfo?.slots ?? [];

  const hasAnyAvailability = useMemo(
    () => Object.values(summary).some((d) => d.capacity > 0),
    [summary],
  );

  const nextAvailableAfter = useCallback(
    (from: Date | null): Date | null => {
      const fromKey = from ? dateKeyLocal(from) : '';
      const key = Object.keys(summary)
        .filter((k) => summary[k].capacity > 0 && (!fromKey || k > fromKey))
        .sort()[0];
      if (!key) return null;
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    [summary],
  );

  const jumpToNextAvailable = () => {
    const next = nextAvailableAfter(selectedInfo?.capacity ? selectedDate : null);
    if (next) {
      setSelectedDate(next);
      setSelectedSlot(null);
    }
  };

  // Group slots by period
  const groupedSlots = useMemo(() => groupSlotsByPeriod(slots), [slots]);

  // Handle date selection from CalendarStrip
  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Reset slot when date changes
  };

  // Handle time selection
  const handleSelectTime = (time: string) => {
    const slot = slots.find((s) => s.start === time);
    if (slot) {
      setSelectedSlot(slot);
    }
  };

  // Toggle section expand/collapse
  const toggleSection = (period: Period) => {
    setExpandedSections((prev) => ({
      ...prev,
      [period]: !prev[period],
    }));
  };

  // Handle continue
  const handleContinue = () => {
    if (!selectedDate || !selectedSlot) return;
    setDateAndSlot(selectedDate, selectedSlot);
    router.push(`/(client)/booking/${providerId}/confirm`);
  };

  // Check if any slots available
  const hasSlots = slots.length > 0;

  // Redirect if no member selected
  if (!memberId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BookingStepHeader title="Choisir une date" onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Erreur"
            description="Veuillez d'abord sélectionner un membre"
            actionLabel="Retour"
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <BookingStepHeader title="Choisir une date" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Booking Summary */}
        {service && provider && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <BookingSummary
              serviceName={cart.length > 1 ? `${cart.length} prestations` : service.name}
              duration={cartDuration}
              price={cartPrice}
              providerName={provider.businessName}
              providerPhotoURL={provider.photoURL}
              memberName={member?.name}
            />
          </View>
        )}

        {/* Month calendar — collapsible: full month to pick, collapses to the
            selected week to leave room for the time slots. */}
        <View style={{ marginTop: spacing.lg }}>
          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            dayStatus={summary}
            minDate={summaryRange.start}
            maxDate={summaryRange.end}
          />
        </View>

        {/* Prochaine dispo shortcut */}
        {!loading && hasAnyAvailability && nextAvailableAfter(selectedDate) && (
          <Pressable
            onPress={jumpToNextAvailable}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}
          >
            <Text variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
              Prochaine dispo
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </Pressable>
        )}

        {/* Time Slots Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text variant="h3">Horaires disponibles</Text>
            {selectedInfo?.status === 'almost_full' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full }}>
                <Ionicons name="flame" size={13} color="#D97706" />
                <Text variant="caption" style={{ color: '#B45309', fontWeight: '600' }}>
                  Bientôt complet · {selectedInfo.capacity}
                </Text>
              </View>
            )}
          </View>

          {loading ? (
            <Card padding="lg" shadow="sm">
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text variant="body" color="textSecondary" style={{ marginTop: spacing.md }}>
                  Chargement des créneaux...
                </Text>
              </View>
            </Card>
          ) : error ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="alert-circle-outline"
                title="Erreur"
                description={error}
              />
            </Card>
          ) : !hasAnyAvailability ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="calendar-outline"
                title="Aucune disponibilité"
                description={`Aucune disponibilité pour cette prestation dans les ${maxAdvanceDays} prochains jours.`}
              />
            </Card>
          ) : !selectedDate ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="calendar-outline"
                title="Choisissez un jour"
                description="Sélectionnez une date disponible dans le calendrier ci-dessus pour voir les horaires."
              />
            </Card>
          ) : !hasSlots ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="time-outline"
                title="Complet ce jour-là"
                description="Aucun créneau pour cette prestation à cette date."
                {...(nextAvailableAfter(null)
                  ? { actionLabel: 'Voir la prochaine disponibilité', onAction: jumpToNextAvailable }
                  : {})}
              />
            </Card>
          ) : (
            <View>
              {PERIODS_CONFIG.map((period) => (
                <TimeSlotSection
                  key={period.key}
                  title={period.label}
                  icon={period.icon}
                  backgroundColor={period.backgroundColor}
                  accentColor={period.accentColor}
                  slots={groupedSlots[period.key]}
                  isExpanded={expandedSections[period.key]}
                  onToggle={() => toggleSection(period.key)}
                  selectedSlot={selectedSlot?.start || null}
                  onSelectSlot={handleSelectTime}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Confirm Button */}
      <StickyConfirmButton
        selectedTime={selectedSlot?.start || null}
        onConfirm={handleContinue}
        disabled={!selectedSlot}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
});
