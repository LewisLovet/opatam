/**
 * Booking Step 2: Date & Time Selection
 * Uses CalendarStrip for date selection and TimeSlotSection for grouped time slots
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import {
  Text,
  Card,
  EmptyState,
  CalendarStrip,
  BookingSummary,
  TimeSlotSection,
  StickyConfirmButton,
} from '../../../../components';
import { useBooking } from '../../../../contexts';
import { availabilityRepository } from '@booking-app/firebase';
import { useAvailableSlots, useNextAvailableDate, type TimeSlot } from '../../../../hooks';

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
  const { provider, service, member, memberId, setDateAndSlot } = useBooking();

  // Get next available date to auto-scroll calendar
  const { nextAvailableDate } = useNextAvailableDate(providerId, memberId ?? undefined);

  // Selected date state - default to next available date, fallback to today
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Auto-select next available date once loaded
  if (nextAvailableDate && !hasAutoSelected) {
    const nextDate = new Date(nextAvailableDate);
    nextDate.setHours(0, 0, 0, 0);
    setSelectedDate(nextDate);
    setHasAutoSelected(true);
  }

  // Load closed days from member's availability schedule
  const [closedDays, setClosedDays] = useState<number[]>([]);
  useEffect(() => {
    if (!providerId || !memberId) return;
    availabilityRepository.getByMember(providerId, memberId).then((avails) => {
      const openDays = avails.filter((a) => a.isOpen && a.slots.length > 0).map((a) => a.dayOfWeek);
      const allDays = [0, 1, 2, 3, 4, 5, 6];
      setClosedDays(allDays.filter((d) => !openDays.includes(d)));
    }).catch(() => {});
  }, [providerId, memberId]);

  // Expanded sections state - all collapsed by default
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });

  // Date range for fetching slots - only fetch for selected date
  const dateRange = useMemo(() => {
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }, [selectedDate.toDateString()]);

  // Fetch available slots for selected date only
  const { slots, loading, error } = useAvailableSlots({
    providerId,
    serviceId: service?.id,
    memberId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

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
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.surface, borderRadius: radius.full }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h2" style={styles.headerTitle}>Choisir une date</Text>
          <View style={styles.headerSpacer} />
        </View>
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface, borderRadius: radius.full }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={styles.headerTitle}>Choisir une date</Text>
        <View style={styles.headerSpacer} />
      </View>

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
              serviceName={service.name}
              duration={service.duration}
              price={service.price}
              providerName={provider.businessName}
              providerPhotoURL={provider.photoURL}
              memberName={member?.name}
            />
          </View>
        )}

        {/* Calendar Strip */}
        <View style={{ marginTop: spacing.lg }}>
          <CalendarStrip
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            closedDays={closedDays}
          />
        </View>

        {/* Time Slots Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text variant="h3" style={{ marginBottom: spacing.md }}>
            Horaires disponibles
          </Text>

          {loading ? (
            <Card padding="xl" shadow="sm">
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
          ) : !hasSlots ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="time-outline"
                title="Aucun créneau"
                description="Aucun créneau disponible pour cette date. Essayez une autre date."
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
