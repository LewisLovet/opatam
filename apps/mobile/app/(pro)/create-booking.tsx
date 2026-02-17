/**
 * Pro Create Booking Screen
 * Multi-step booking creation flow for providers to manually create bookings.
 * Steps: 1. Select Service -> 2. Select Date & Time -> 3. Client Info -> 4. Confirmation
 *
 * Redesigned with:
 * - Visual progress stepper (circles + connecting lines)
 * - Richer service cards with duration/price pills
 * - Time slots grouped by period (Matin / Après-midi / Soir) with collapsible sections
 * - Clean client form with icons
 * - Receipt-style confirmation summary
 * - Animated step transitions
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../theme';
import {
  Text,
  Card,
  Button,
  Input,
  Loader,
  CalendarStrip,
  EmptyState,
  Avatar,
  Divider,
  TimeSlotSection,
} from '../../components';
import { useProvider, useAuth } from '../../contexts';
import {
  catalogService,
  schedulingService,
  bookingService,
  memberService,
  locationService,
} from '@booking-app/firebase';
import type { Service, Member, Location } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface SlotWithMember {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
  memberId: string;
}

// ---------------------------------------------------------------------------
// Period configuration for time slot grouping
// ---------------------------------------------------------------------------

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
    backgroundColor: '#FEF3C7',
    accentColor: '#D97706',
  },
  {
    key: 'afternoon',
    label: 'Après-midi',
    icon: 'partly-sunny',
    backgroundColor: '#FFEDD5',
    accentColor: '#EA580C',
  },
  {
    key: 'evening',
    label: 'Soir',
    icon: 'moon',
    backgroundColor: '#E0E7FF',
    accentColor: '#4F46E5',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatFrenchDate(date: Date): string {
  const day = DAYS[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${dayOfMonth} ${month} ${year}`;
}

function formatPrice(centimes: number): string {
  const euros = centimes / 100;
  return euros.toFixed(2).replace('.', ',') + ' €';
}

/** Parse "HH:MM" into hour number */
function getHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

/** Capitalize first letter */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Step labels for the stepper
const STEP_LABELS: Record<Step, string> = {
  1: 'Service',
  2: 'Horaire',
  3: 'Client',
  4: 'Résumé',
};

const STEP_TITLES: Record<Step, string> = {
  1: 'Choisir une prestation',
  2: 'Date et heure',
  3: 'Informations client',
  4: 'Confirmation',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * ProgressStepper
 * Horizontal row of 4 circles connected by lines.
 * Active = primary bg + white number, Completed = success bg + checkmark, Future = surfaceSecondary + muted number.
 */
function ProgressStepper({ currentStep }: { currentStep: Step }) {
  const { colors, spacing, radius } = useTheme();

  const steps: Step[] = [1, 2, 3, 4];

  return (
    <View style={[stepperStyles.container, { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg }]}>
      <View style={stepperStyles.row}>
        {steps.map((step, index) => {
          const isCompleted = step < currentStep;
          const isActive = step === currentStep;
          const isFuture = step > currentStep;

          const circleSize = isActive ? 28 : 24;

          return (
            <React.Fragment key={step}>
              {/* Connecting line before (except first) */}
              {index > 0 && (
                <View
                  style={[
                    stepperStyles.line,
                    {
                      backgroundColor: step <= currentStep ? colors.primary : colors.border,
                      height: 2,
                    },
                  ]}
                />
              )}

              {/* Step circle + label */}
              <View style={stepperStyles.stepColumn}>
                <View
                  style={[
                    stepperStyles.circle,
                    {
                      width: circleSize,
                      height: circleSize,
                      borderRadius: circleSize / 2,
                      backgroundColor: isCompleted
                        ? colors.success
                        : isActive
                          ? colors.primary
                          : colors.surfaceSecondary,
                    },
                    isFuture && {
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={14} color={colors.textInverse} />
                  ) : (
                    <Text
                      variant="caption"
                      style={{
                        color: isActive ? colors.textInverse : colors.textMuted,
                        fontWeight: isActive ? '700' : '500',
                        fontSize: isActive ? 13 : 11,
                      }}
                    >
                      {step}
                    </Text>
                  )}
                </View>
                <Text
                  variant="caption"
                  color={isActive ? 'text' : 'textMuted'}
                  style={{
                    marginTop: spacing.xs,
                    fontWeight: isActive ? '600' : '400',
                    fontSize: 10,
                  }}
                >
                  {STEP_LABELS[step]}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  line: {
    flex: 1,
    marginTop: 12,
    marginHorizontal: 4,
  },
  stepColumn: {
    alignItems: 'center',
    minWidth: 44,
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateBookingScreen() {
  const { colors, spacing, radius, shadows } = useTheme();
  const router = useRouter();
  const { providerId } = useProvider();
  const { user } = useAuth();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  // -- Step state -------------------------------------------------------------
  const [step, setStep] = useState<Step>(1);

  // -- Animation refs for step transitions ------------------------------------
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateStepTransition = useCallback(
    (direction: 'forward' | 'backward', callback: () => void) => {
      const slideOut = direction === 'forward' ? -30 : 30;
      const slideIn = direction === 'forward' ? 30 : -30;

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: slideOut,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        callback();
        slideAnim.setValue(slideIn);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [fadeAnim, slideAnim],
  );

  // -- Data -------------------------------------------------------------------
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // -- Step 1 -----------------------------------------------------------------
  const [selectedService, setSelectedService] = useState<WithId<Service> | null>(null);

  // -- Step 2 -----------------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [slots, setSlots] = useState<SlotWithMember[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithMember | null>(null);

  // Expanded sections state for collapsible time period groups (collapsed by default)
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });

  // -- Step 3 -----------------------------------------------------------------
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');

  // -- Step 4 -----------------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);

  // -- Load initial data on mount ---------------------------------------------
  useEffect(() => {
    if (!providerId) return;

    const loadData = async () => {
      try {
        setLoadingData(true);
        const [servicesData, membersData, locationsData] = await Promise.all([
          catalogService.getActiveByProvider(providerId),
          memberService.getByProvider(providerId),
          locationService.getByProvider(providerId),
        ]);
        setServices(servicesData);
        setMembers(membersData);
        setLocations(locationsData);
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Erreur', 'Impossible de charger les données.');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [providerId]);

  // -- Load slots when date or service changes (step 2) -----------------------
  useEffect(() => {
    if (step !== 2 || !selectedService || !providerId) return;

    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);

        // Fetch slots for all members in parallel
        const allSlots: SlotWithMember[] = [];
        const activeMembers = members.filter((m) => m.isActive);

        const promises = activeMembers.map(async (member) => {
          try {
            const memberSlots = await schedulingService.getAvailableSlots({
              providerId,
              serviceId: selectedService.id,
              memberId: member.id,
              startDate: selectedDate,
              endDate: selectedDate,
            });
            return memberSlots.map((slot) => ({
              ...slot,
              memberId: member.id,
            }));
          } catch {
            // If a member has no availability, skip silently
            return [];
          }
        });

        const results = await Promise.all(promises);
        for (const memberSlots of results) {
          allSlots.push(...memberSlots);
        }

        // Sort by start time
        allSlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

        // Deduplicate by datetime + memberId
        const seen = new Set<string>();
        const uniqueSlots = allSlots.filter((slot) => {
          const key = `${slot.datetime.getTime()}-${slot.memberId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setSlots(uniqueSlots);

        // Keep sections collapsed by default — user will expand manually
        setExpandedSections({ morning: false, afternoon: false, evening: false });
      } catch (error) {
        console.error('Error loading slots:', error);
        Alert.alert('Erreur', 'Impossible de charger les créneaux disponibles.');
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    loadSlots();
  }, [step, selectedDate, selectedService, providerId, members]);

  // -- Grouped slots by period ------------------------------------------------
  const groupedSlots = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    const seen = new Set<string>();

    for (const slot of slots) {
      // Deduplicate by start time for display (we just need unique times)
      if (seen.has(slot.start)) continue;
      seen.add(slot.start);

      const hour = getHour(slot.start);
      if (hour < 12) {
        morning.push(slot.start);
      } else if (hour < 17) {
        afternoon.push(slot.start);
      } else {
        evening.push(slot.start);
      }
    }

    return { morning, afternoon, evening };
  }, [slots]);

  // Map from time string back to the SlotWithMember for selection
  const slotByTime = useMemo(() => {
    const map = new Map<string, SlotWithMember>();
    for (const slot of slots) {
      if (!map.has(slot.start)) {
        map.set(slot.start, slot);
      }
    }
    return map;
  }, [slots]);

  // -- Navigation -------------------------------------------------------------
  const goBack = useCallback(() => {
    if (step === 1) {
      router.back();
    } else {
      animateStepTransition('backward', () => {
        setStep((prev) => (prev - 1) as Step);
      });
    }
  }, [step, router, animateStepTransition]);

  const handleSelectService = useCallback(
    (service: WithId<Service>) => {
      setSelectedService(service);
      animateStepTransition('forward', () => {
        setStep(2);
      });
    },
    [animateStepTransition],
  );

  const handleSelectSlot = useCallback(
    (time: string) => {
      const slot = slotByTime.get(time);
      if (slot) {
        setSelectedSlot(slot);
      }
    },
    [slotByTime],
  );

  const handleConfirmSlot = useCallback(() => {
    if (!selectedSlot) return;
    animateStepTransition('forward', () => {
      setStep(3);
    });
  }, [selectedSlot, animateStepTransition]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const toggleSection = useCallback((period: Period) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => ({
      ...prev,
      [period]: !prev[period],
    }));
  }, []);

  const handleNextFromClientInfo = useCallback(() => {
    if (!clientName.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir le nom du client.');
      return;
    }
    if (!clientEmail.trim()) {
      Alert.alert('Champ requis', "Veuillez saisir l'email du client.");
      return;
    }
    if (!clientPhone.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir le numéro de téléphone du client.');
      return;
    }
    animateStepTransition('forward', () => {
      setStep(4);
    });
  }, [clientName, clientEmail, clientPhone, animateStepTransition]);

  // -- Derived info for step 4 ------------------------------------------------
  const selectedMember = useMemo(() => {
    if (!selectedSlot) return null;
    return members.find((m) => m.id === selectedSlot.memberId) ?? null;
  }, [selectedSlot, members]);

  const memberLocation = useMemo(() => {
    if (!selectedMember) return null;
    return locations.find((l) => l.id === selectedMember.locationId) ?? null;
  }, [selectedMember, locations]);

  // -- Submit booking ---------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!selectedService || !selectedSlot || !providerId || !memberLocation) return;

    try {
      setSubmitting(true);

      await bookingService.createBooking({
        providerId,
        serviceId: selectedService.id,
        memberId: selectedSlot.memberId,
        locationId: memberLocation.id,
        datetime: new Date(selectedSlot.datetime),
        clientInfo: {
          name: clientName.trim(),
          email: clientEmail.trim(),
          phone: clientPhone.trim(),
        },
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        'Rendez-vous créé',
        'Le rendez-vous a été créé avec succès.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de créer le rendez-vous. Veuillez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedService,
    selectedSlot,
    providerId,
    memberLocation,
    clientName,
    clientEmail,
    clientPhone,
    notes,
    router,
  ]);

  // -- Loading state ----------------------------------------------------------
  if (loadingData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  // -- Render -----------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }]}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={[
            styles.backButton,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={styles.headerTitle}>
          {STEP_TITLES[step]}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Progress Stepper ───────────────────────────────────────────── */}
      <ProgressStepper currentStep={step} />

      {/* ── Animated Step Content ──────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* ── Step 1: Select Service ───────────────────────────────────── */}
        {step === 1 && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {services.length === 0 ? (
              <EmptyState
                icon="list-outline"
                title="Aucune prestation"
                description="Vous n'avez pas encore de prestation active."
              />
            ) : (
              services.map((service) => {
                const isSelected = selectedService?.id === service.id;
                return (
                  <Card
                    key={service.id}
                    padding="lg"
                    shadow="sm"
                    onPress={() => handleSelectService(service)}
                    style={{
                      marginBottom: spacing.md,
                      ...(isSelected
                        ? {
                            backgroundColor: colors.primaryLight,
                            borderColor: colors.primary,
                          }
                        : {}),
                    }}
                  >
                    <View style={styles.serviceCardContent}>
                      <View style={styles.serviceCardInfo}>
                        <Text variant="h3">{service.name}</Text>

                        {/* Duration + Price pills */}
                        <View style={[styles.pillRow, { marginTop: spacing.sm }]}>
                          {/* Duration pill */}
                          <View
                            style={[
                              styles.pill,
                              {
                                backgroundColor: colors.surfaceSecondary,
                                borderRadius: radius.full,
                                paddingHorizontal: spacing.sm,
                                paddingVertical: spacing.xs,
                              },
                            ]}
                          >
                            <Ionicons
                              name="time-outline"
                              size={13}
                              color={colors.textSecondary}
                              style={{ marginRight: 4 }}
                            />
                            <Text variant="caption" color="textSecondary">
                              {service.duration} min
                            </Text>
                          </View>

                          {/* Price pill */}
                          <View
                            style={[
                              styles.pill,
                              {
                                backgroundColor: colors.primaryLight,
                                borderRadius: radius.full,
                                paddingHorizontal: spacing.sm,
                                paddingVertical: spacing.xs,
                                marginLeft: spacing.sm,
                              },
                            ]}
                          >
                            <Ionicons
                              name="pricetag-outline"
                              size={13}
                              color={colors.primary}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              variant="body"
                              color="primary"
                              style={{ fontWeight: '600', fontSize: 13 }}
                            >
                              {formatPrice(service.price)}
                            </Text>
                          </View>
                        </View>

                        {/* Description (max 2 lines) */}
                        {service.description ? (
                          <Text
                            variant="bodySmall"
                            color="textSecondary"
                            numberOfLines={2}
                            style={{ marginTop: spacing.sm }}
                          >
                            {service.description}
                          </Text>
                        ) : null}
                      </View>

                      {/* Right chevron */}
                      <View style={styles.serviceChevron}>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ── Step 2: Select Date & Time ───────────────────────────────── */}
        {step === 2 && (
          <View style={styles.flex}>
            {/* Calendar strip */}
            <View style={{ paddingVertical: spacing.md }}>
              <CalendarStrip
                selectedDate={selectedDate}
                onSelectDate={handleDateChange}
              />
            </View>

            {/* Time slots */}
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] }]}
              showsVerticalScrollIndicator={false}
            >
              <Text variant="h3" style={{ marginBottom: spacing.md }}>
                Horaires disponibles
              </Text>

              {loadingSlots ? (
                <Card padding="lg" shadow="sm">
                  <View style={styles.loaderContainerSmall}>
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
              ) : slots.length === 0 ? (
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
                      slots={groupedSlots[period.key]}
                      isExpanded={expandedSections[period.key]}
                      onToggle={() => toggleSection(period.key)}
                      selectedSlot={selectedSlot?.start || null}
                      onSelectSlot={handleSelectSlot}
                    />
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Fixed bottom button */}
            {selectedSlot && (
              <View
                style={[
                  styles.fixedBottomButton,
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
                  title={`Continuer — ${selectedSlot.start}`}
                  variant="primary"
                  size="lg"
                  onPress={handleConfirmSlot}
                  fullWidth
                  leftIcon={
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={colors.textInverse}
                    />
                  }
                />
              </View>
            )}
          </View>
        )}

        {/* ── Step 3: Client Info ──────────────────────────────────────── */}
        {step === 3 && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ marginBottom: spacing.lg }}>
                <Input
                  label="Nom *"
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Nom du client"
                  autoCapitalize="words"
                  leftIcon={
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  }
                />
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <Input
                  label="Email *"
                  value={clientEmail}
                  onChangeText={setClientEmail}
                  placeholder="email@exemple.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon={
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  }
                />
              </View>

              <View style={{ marginBottom: spacing.sm }}>
                <Input
                  label="Téléphone *"
                  value={clientPhone}
                  onChangeText={setClientPhone}
                  placeholder="06 12 34 56 78"
                  keyboardType="phone-pad"
                  leftIcon={
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  }
                />
              </View>
              <Text
                variant="caption"
                color="textMuted"
                style={{ marginBottom: spacing.lg, marginLeft: spacing.xs }}
              >
                Le client recevra une confirmation par email
              </Text>

              <View style={{ marginBottom: spacing['2xl'] }}>
                <Input
                  label="Notes"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes optionnelles..."
                  multiline
                  numberOfLines={3}
                  leftIcon={
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  }
                />
              </View>

              <Button
                title="Suivant"
                variant="primary"
                size="lg"
                onPress={handleNextFromClientInfo}
                fullWidth
                rightIcon={
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={colors.textInverse}
                  />
                }
              />
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── Step 4: Confirmation ─────────────────────────────────────── */}
        {step === 4 && selectedService && selectedSlot && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Receipt-style card */}
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              {/* Service name + price header */}
              <View style={styles.receiptHeader}>
                <Text variant="h2" style={styles.receiptServiceName}>
                  {selectedService.name}
                </Text>
                <Text
                  variant="h2"
                  color="primary"
                  style={{ fontWeight: '700' }}
                >
                  {formatPrice(selectedService.price)}
                </Text>
              </View>

              {/* Dashed divider */}
              <View
                style={[
                  styles.dashedDivider,
                  { borderColor: colors.border, marginVertical: spacing.lg },
                ]}
              />

              {/* Detail rows */}
              <View style={{ gap: spacing.md }}>
                {/* Date */}
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextColumn}>
                    <Text variant="caption" color="textMuted">Date</Text>
                    <Text variant="body">{capitalize(formatFrenchDate(selectedSlot.datetime))}</Text>
                  </View>
                </View>

                {/* Time */}
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextColumn}>
                    <Text variant="caption" color="textMuted">Horaire</Text>
                    <Text variant="body">{selectedSlot.start} - {selectedSlot.end}</Text>
                  </View>
                </View>

                {/* Duration */}
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.detailTextColumn}>
                    <Text variant="caption" color="textMuted">Durée</Text>
                    <Text variant="body">{selectedService.duration} min</Text>
                  </View>
                </View>

                {/* Member */}
                {selectedMember && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconCircle, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="person-outline" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.detailTextColumn}>
                      <Text variant="caption" color="textMuted">Membre</Text>
                      <Text variant="body">{selectedMember.name}</Text>
                    </View>
                  </View>
                )}

                {/* Location */}
                {memberLocation && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconCircle, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.detailTextColumn}>
                      <Text variant="caption" color="textMuted">Lieu</Text>
                      <Text variant="body">{memberLocation.name}</Text>
                      {memberLocation.address && (
                        <Text variant="caption" color="textSecondary">
                          {memberLocation.address?.trim()
                            ? `${memberLocation.address}, ${memberLocation.postalCode} ${memberLocation.city}`
                            : `${memberLocation.postalCode} ${memberLocation.city}`}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* Dashed divider */}
              <View
                style={[
                  styles.dashedDivider,
                  { borderColor: colors.border, marginVertical: spacing.lg },
                ]}
              />

              {/* Client section */}
              <View>
                <Text
                  variant="caption"
                  color="textMuted"
                  style={{ marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 }}
                >
                  Client
                </Text>
                <View style={styles.clientRow}>
                  <Avatar name={clientName || '?'} size="md" />
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text variant="body" style={{ fontWeight: '600' }}>
                      {clientName}
                    </Text>
                    <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
                      {clientEmail}
                    </Text>
                    <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
                      {clientPhone}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Notes */}
              {notes.trim() ? (
                <View style={{ marginTop: spacing.lg }}>
                  <Text
                    variant="caption"
                    color="textMuted"
                    style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    Notes
                  </Text>
                  <View
                    style={[
                      styles.notesBox,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderRadius: radius.md,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <Text variant="bodySmall" color="textSecondary">
                      {notes}
                    </Text>
                  </View>
                </View>
              ) : null}
            </Card>

            {/* Confirm button */}
            <Button
              title="Confirmer le rendez-vous"
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
              fullWidth
              leftIcon={
                !submitting ? (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color={colors.textInverse}
                  />
                ) : undefined
              }
            />

            {/* Helper text */}
            <Text
              variant="caption"
              color="textMuted"
              align="center"
              style={{ marginTop: spacing.md, marginBottom: spacing['2xl'] }}
            >
              Le client recevra un email de confirmation
            </Text>
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loaderContainerSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Step 1 — Service cards
  serviceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceCardInfo: {
    flex: 1,
  },
  serviceChevron: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Step 2 — Fixed bottom button
  fixedBottomButton: {},

  // Step 4 — Confirmation receipt
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptServiceName: {
    flex: 1,
    marginRight: 12,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  detailTextColumn: {
    flex: 1,
    gap: 2,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesBox: {},
});
