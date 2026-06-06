/**
 * Pro Create Booking Screen
 * Multi-step booking creation flow for providers to manually create bookings.
 * Steps (single member):   1. Service -> 2. Date & Time -> 3. Client Info -> 4. Confirmation
 * Steps (multiple members): 1. Service -> 2. Member -> 3. Date & Time -> 4. Client Info -> 5. Confirmation
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
  Modal,
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
  SubscriptionRequiredModal,
} from '../../components';
import { useProvider, useAuth, useSubscriptionStatus } from '../../contexts';
import {
  catalogService,
  schedulingService,
  bookingService,
  memberService,
  locationService,
} from '@booking-app/firebase';
import {
  computeServiceTotal,
  emptyServiceSelections,
  serviceHasChoices,
} from '@booking-app/shared';
import type { Service, Member, Location, ProviderClient, ServiceSelections } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { ServiceChoicesPreview } from '../../components/business/ServiceChoicesPreview';
import { useProviderClients } from '../../hooks/useProviderClients';

// ─── Client autocomplete (step "Informations client") ──────────────────
// Min number of "regular" clients (>= 2 bookings) before we proactively
// surface frequent clients on an empty form.
const CLIENT_REGULAR_THRESHOLD = 10;
const CLIENT_FREQUENT_SHOWN = 5;
const CLIENT_MATCH_SHOWN = 6;
type ClientQueryField = 'name' | 'email' | 'phone' | null;

function normalizeClientText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
function clientDigits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

/**
 * Suggestion list rendered inline under the "Nom" field. Driven by the
 * last-edited field (not focus, because the shared Input owns onFocus for
 * its border animation). Searches name + email + phone at once so the pro
 * can find a client by whichever detail they type. When the form is still
 * empty and the provider has enough regulars, we proactively show the most
 * frequent clients. Tapping a row fills all three fields via onPick.
 */
function ClientSuggestionPanel({
  clients,
  queryField,
  name,
  email,
  phone,
  onPick,
  colors,
  spacing,
  radius,
}: {
  clients: WithId<ProviderClient>[];
  queryField: ClientQueryField;
  name: string;
  email: string;
  phone: string;
  onPick: (c: WithId<ProviderClient>) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  radius: ReturnType<typeof useTheme>['radius'];
}) {
  const allEmpty = !name.trim() && !email.trim() && !phone.trim();

  const frequent = useMemo(() => {
    const regulars = clients.filter((c) => (c.bookingsCount ?? 0) >= 2);
    if (regulars.length < CLIENT_REGULAR_THRESHOLD) return [];
    return [...clients]
      .sort((a, b) => (b.bookingsCount ?? 0) - (a.bookingsCount ?? 0))
      .slice(0, CLIENT_FREQUENT_SHOWN);
  }, [clients]);

  const query =
    queryField === 'name' ? name : queryField === 'email' ? email : queryField === 'phone' ? phone : '';

  const matches = useMemo(() => {
    const qN = normalizeClientText(query);
    const qD = clientDigits(query);
    if (!qN && qD.length < 2) return [];
    const out: WithId<ProviderClient>[] = [];
    for (const c of clients) {
      const nameN = normalizeClientText(c.name || '');
      const emailN = normalizeClientText(c.email || '');
      const phoneD = clientDigits(c.phone || '');
      const byText = qN.length >= 1 && (nameN.includes(qN) || emailN.includes(qN));
      const byPhone = qD.length >= 2 && phoneD.includes(qD);
      if (byText || byPhone) {
        out.push(c);
        if (out.length >= CLIENT_MATCH_SHOWN) break;
      }
    }
    return out;
  }, [clients, query]);

  const isFrequent = queryField === null && allEmpty && frequent.length > 0;
  const list = isFrequent
    ? frequent
    : queryField !== null && query.trim().length > 0
      ? matches
      : [];
  if (list.length === 0) return null;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        marginTop: spacing.xs,
        overflow: 'hidden',
      }}
    >
      {isFrequent && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Ionicons name="star" size={12} color={colors.textMuted} />
          <Text
            variant="caption"
            color="textMuted"
            style={{ textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5 }}
          >
            Clients fréquents
          </Text>
        </View>
      )}
      {list.map((c, i) => (
        <Pressable
          key={c.id}
          onPress={() => onPick(c)}
          android_ripple={{ color: colors.surfaceSecondary }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: colors.border,
            backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
          })}
        >
          <Avatar name={c.name || 'Client'} size="sm" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="body" style={{ fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                {c.name || 'Client'}
              </Text>
              {(c.bookingsCount ?? 0) > 0 && (
                <Text variant="caption" color="textMuted">
                  {c.bookingsCount} RDV
                </Text>
              )}
            </View>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {[c.email, c.phone].filter(Boolean).join('  ·  ')}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4 | 5;

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

// Step labels/titles — with or without member step
const STEP_LABELS_WITH_MEMBER: Record<Step, string> = {
  1: 'Service',
  2: 'Membre',
  3: 'Horaire',
  4: 'Client',
  5: 'Résumé',
};

const STEP_LABELS_WITHOUT_MEMBER: Record<Step, string> = {
  1: 'Service',
  2: 'Horaire',
  3: 'Client',
  4: 'Résumé',
  5: '', // unused
};

const STEP_TITLES_WITH_MEMBER: Record<Step, string> = {
  1: 'Choisir une prestation',
  2: 'Choisir un membre',
  3: 'Date et heure',
  4: 'Informations client',
  5: 'Confirmation',
};

const STEP_TITLES_WITHOUT_MEMBER: Record<Step, string> = {
  1: 'Choisir une prestation',
  2: 'Date et heure',
  3: 'Informations client',
  4: 'Confirmation',
  5: '', // unused
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * ProgressStepper
 * Horizontal row of circles connected by lines.
 * Active = primary bg + white number, Completed = success bg + checkmark, Future = surfaceSecondary + muted number.
 */
function ProgressStepper({
  currentStep,
  totalSteps,
  stepLabels,
}: {
  currentStep: Step;
  totalSteps: number;
  stepLabels: Record<Step, string>;
}) {
  const { colors, spacing, radius } = useTheme();

  const steps = Array.from({ length: totalSteps }, (_, i) => (i + 1) as Step);

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
                  {stepLabels[step]}
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
  const sub = useSubscriptionStatus();
  // Pre-fill identity step when launched from /pro/client-detail
  // — `clientName/Email/Phone` arrive URL-encoded by expo-router
  // and are decoded automatically here.
  const {
    date: dateParam,
    memberId: memberIdParam,
    clientName: clientNameParam,
    clientEmail: clientEmailParam,
    clientPhone: clientPhoneParam,
  } = useLocalSearchParams<{
    date?: string;
    memberId?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
  }>();

  // Subscription guard — show modal if trial expired
  const [showSubModal, setShowSubModal] = useState(false);
  useEffect(() => {
    if (sub.needsSubscription) setShowSubModal(true);
  }, [sub.needsSubscription]);

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
  // Multi-prestation cart. The FIRST service drives the member/slot/
  // confirmation primary view; the rest are booked back-to-back in the
  // same visit (durations sum, single buffer after the last one).
  const [selectedServices, setSelectedServices] = useState<WithId<Service>[]>([]);
  // Variation / option / info selections per chosen service (id → selections).
  const [selectionsByService, setSelectionsByService] = useState<Record<string, ServiceSelections>>({});
  // Service awaiting variation/option choices (picker modal). null = none.
  const [pendingChoiceService, setPendingChoiceService] = useState<WithId<Service> | null>(null);

  const selectedService = selectedServices[0] ?? null;
  // Effective price/duration of a service given its chosen variations/options.
  const effFor = useCallback(
    (s: WithId<Service>) =>
      computeServiceTotal(s, selectionsByService[s.id] ?? emptyServiceSelections()),
    [selectionsByService],
  );
  const totalServiceDuration = useMemo(
    () => selectedServices.reduce((sum, s) => sum + effFor(s).duration, 0),
    [selectedServices, effFor],
  );
  const totalServicePrice = useMemo(
    () => selectedServices.reduce((sum, s) => sum + effFor(s).price, 0),
    [selectedServices, effFor],
  );
  // Full visit length for the availability search (services back-to-back +
  // one buffer after the last). Mirrors booking.service aggregation.
  const totalVisitDuration = useMemo(() => {
    if (selectedServices.length === 0) return 0;
    const lastBuffer = selectedServices[selectedServices.length - 1].bufferTime || 0;
    return totalServiceDuration + lastBuffer;
  }, [selectedServices, totalServiceDuration]);

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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(memberIdParam ?? null);
  const [slots, setSlots] = useState<SlotWithMember[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotWithMember | null>(null);

  // -- Member availability info (for member step + calendar) ------------------
  const [nextAvailByMember, setNextAvailByMember] = useState<Record<string, Date | null>>({});
  const [loadingNextAvail, setLoadingNextAvail] = useState(false);
  const [memberClosedDays, setMemberClosedDays] = useState<number[]>([]);

  // Expanded sections state for collapsible time period groups (collapsed by default)
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });

  // -- Step 3 -----------------------------------------------------------------
  // Pre-filled from URL params when launched from a client fiche
  // (see /pro/client-detail/[key]). Plain string defaults — empty
  // params resolve to '' so the controlled inputs stay valid.
  const [clientName, setClientName] = useState(clientNameParam ?? '');
  const [clientEmail, setClientEmail] = useState(clientEmailParam ?? '');
  const [clientPhone, setClientPhone] = useState(clientPhoneParam ?? '');
  const [notes, setNotes] = useState('');

  // Client autocomplete: existing client base + which field is being typed
  // in right now (drives the suggestion list under the Nom field).
  const { clients: providerClients } = useProviderClients(providerId ?? undefined);
  const [clientQueryField, setClientQueryField] = useState<ClientQueryField>(null);

  const handlePickClient = useCallback((c: WithId<ProviderClient>) => {
    setClientName(c.name || '');
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');
    setClientQueryField(null);
  }, []);

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

  // -- Member step logic -------------------------------------------------------
  const activeMembers = useMemo(() => members.filter((m) => m.isActive), [members]);
  const needsMemberStep = activeMembers.length > 1;
  const totalSteps = needsMemberStep ? 5 : 4;
  const stepLabels = needsMemberStep ? STEP_LABELS_WITH_MEMBER : STEP_LABELS_WITHOUT_MEMBER;
  const stepTitles = needsMemberStep ? STEP_TITLES_WITH_MEMBER : STEP_TITLES_WITHOUT_MEMBER;

  // Step mapping: which internal step corresponds to which screen
  // With member step: 1=Service, 2=Member, 3=TimeSlot, 4=Client, 5=Confirm
  // Without:          1=Service,            2=TimeSlot, 3=Client, 4=Confirm
  const STEP_TIMESLOT = needsMemberStep ? 3 : 2;
  const STEP_CLIENT = needsMemberStep ? 4 : 3;
  const STEP_CONFIRM = needsMemberStep ? 5 : 4;
  const STEP_MEMBER = 2; // only used when needsMemberStep

  // Auto-select member when only one active member
  useEffect(() => {
    if (activeMembers.length === 1 && !selectedMemberId) {
      setSelectedMemberId(activeMembers[0].id);
    }
  }, [activeMembers, selectedMemberId]);

  // -- Fetch next availability per member when entering member step ------------
  useEffect(() => {
    if (!needsMemberStep || step !== STEP_MEMBER || !selectedService || !providerId) return;

    let cancelled = false;
    const fetchNextAvail = async () => {
      setLoadingNextAvail(true);
      const result: Record<string, Date | null> = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lookAhead = new Date(today);
      lookAhead.setDate(lookAhead.getDate() + 14);

      await Promise.all(
        activeMembers.map(async (member) => {
          try {
            const memberSlots = await schedulingService.getAvailableSlots({
              providerId,
              serviceId: selectedService.id,
              memberId: member.id,
              startDate: today,
              endDate: lookAhead,
              durationOverride: totalVisitDuration,
            });
            result[member.id] = memberSlots.length > 0 ? memberSlots[0].datetime : null;
          } catch {
            result[member.id] = null;
          }
        }),
      );

      if (!cancelled) {
        setNextAvailByMember(result);
        setLoadingNextAvail(false);
      }
    };

    fetchNextAvail();
    return () => { cancelled = true; };
  }, [needsMemberStep, step, STEP_MEMBER, selectedService, providerId, activeMembers, totalVisitDuration]);

  // -- Fetch closed days for selected member (for CalendarStrip) --------------
  useEffect(() => {
    if (!selectedMemberId || !providerId) {
      setMemberClosedDays([]);
      return;
    }

    let cancelled = false;
    const fetchClosedDays = async () => {
      try {
        const schedule = await schedulingService.getWeeklySchedule(providerId, selectedMemberId);
        // Days where isOpen is false or no entry = closed
        const openDays = new Set(schedule.filter((a) => a.isOpen).map((a) => a.dayOfWeek));
        const closed: number[] = [];
        for (let d = 0; d < 7; d++) {
          if (!openDays.has(d)) closed.push(d);
        }
        if (!cancelled) setMemberClosedDays(closed);
      } catch {
        if (!cancelled) setMemberClosedDays([]);
      }
    };

    fetchClosedDays();
    return () => { cancelled = true; };
  }, [selectedMemberId, providerId]);

  // -- Load slots when date or service changes (step 2) -----------------------
  useEffect(() => {
    if (step !== STEP_TIMESLOT || !selectedService || !providerId || !selectedMemberId) return;

    const loadSlots = async () => {
      try {
        setLoadingSlots(true);
        setSelectedSlot(null);

        // Fetch slots for selected member or all active members
        const allSlots: SlotWithMember[] = [];
        const membersToFetch = selectedMemberId
          ? activeMembers.filter((m) => m.id === selectedMemberId)
          : activeMembers;

        const promises = membersToFetch.map(async (member) => {
          try {
            const memberSlots = await schedulingService.getAvailableSlots({
              providerId,
              serviceId: selectedService.id,
              memberId: member.id,
              startDate: selectedDate,
              endDate: selectedDate,
              // Total length of the whole visit (all prestations + buffer).
              durationOverride: totalVisitDuration,
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
  }, [step, STEP_TIMESLOT, selectedDate, selectedService, providerId, activeMembers, selectedMemberId, totalVisitDuration]);

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

  const addServiceToCart = useCallback(
    (service: WithId<Service>, selections?: ServiceSelections) => {
      setSelectedServices((prev) =>
        prev.some((s) => s.id === service.id) ? prev : [...prev, service],
      );
      if (selections) {
        setSelectionsByService((prev) => ({ ...prev, [service.id]: selections }));
      }
      setSelectedSlot(null);
    },
    [],
  );

  // Tap a service: toggle off if already in the visit; else open the choices
  // picker (variations/options) when it has any, otherwise add it directly.
  // Tapping no longer auto-advances — add as many as needed then "Continuer".
  const handleSelectService = useCallback(
    (service: WithId<Service>) => {
      if (selectedServices.some((s) => s.id === service.id)) {
        setSelectedServices((prev) => prev.filter((s) => s.id !== service.id));
        setSelectionsByService((prev) => {
          const next = { ...prev };
          delete next[service.id];
          return next;
        });
        setSelectedSlot(null);
        return;
      }
      if (serviceHasChoices(service)) {
        setPendingChoiceService(service);
      } else {
        addServiceToCart(service);
      }
    },
    [selectedServices, addServiceToCart],
  );

  const proceedFromServices = useCallback(() => {
    if (selectedServices.length === 0) return;
    animateStepTransition('forward', () => {
      setStep((needsMemberStep ? STEP_MEMBER : STEP_TIMESLOT) as Step);
    });
  }, [selectedServices.length, animateStepTransition, needsMemberStep, STEP_TIMESLOT]);

  const handleSelectMember = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      setSelectedSlot(null);

      // Jump to the member's next available date if known
      const nextAvail = nextAvailByMember[memberId];
      if (nextAvail) {
        const nextDate = new Date(nextAvail);
        nextDate.setHours(0, 0, 0, 0);
        setSelectedDate(nextDate);
      }

      animateStepTransition('forward', () => {
        setStep(STEP_TIMESLOT as Step);
      });
    },
    [animateStepTransition, STEP_TIMESLOT, nextAvailByMember],
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
      setStep(STEP_CLIENT as Step);
    });
  }, [selectedSlot, animateStepTransition, STEP_CLIENT]);

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
      setStep(STEP_CONFIRM as Step);
    });
  }, [clientName, clientEmail, clientPhone, animateStepTransition, STEP_CONFIRM]);

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

      // Route through /api/bookings (source:'pro' + askDeposit:true) so
      // the deposit flow is honored: if the service has an active
      // deposit configured, the server creates the booking as
      // pending_payment and emails the client a Stripe Checkout link.
      // Otherwise the booking is confirmed immediately.
      const apiUrl = process.env.EXPO_PUBLIC_APP_URL ?? 'https://opatam.com';
      const res = await fetch(`${apiUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          serviceId: selectedService.id,
          // Multi-prestation visit: the server recomputes durations/prices
          // and aggregates. serviceId (first) kept for back-compat.
          items: selectedServices.map((s) => ({
            serviceId: s.id,
            selections: selectionsByService[s.id],
          })),
          memberId: selectedSlot.memberId,
          locationId: memberLocation.id,
          datetime: new Date(selectedSlot.datetime).toISOString(),
          clientInfo: {
            name: clientName.trim(),
            email: clientEmail.trim(),
            phone: clientPhone.trim(),
          },
          notes: notes.trim() || undefined,
          source: 'pro',
          askDeposit: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Impossible de créer le rendez-vous.');
      }

      Alert.alert(
        data.paymentRequested ? 'Lien de paiement envoyé' : 'Rendez-vous créé',
        data.paymentRequested
          ? `Un email avec un lien de paiement a été envoyé à ${clientEmail.trim()}. La réservation reste en attente jusqu'au paiement (30 min max).`
          : 'Le rendez-vous a été créé avec succès.',
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
    selectedServices,
    selectionsByService,
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
      {/* Subscription required modal */}
      <SubscriptionRequiredModal
        visible={showSubModal}
        onClose={() => { setShowSubModal(false); router.back(); }}
        context="Créez des rendez-vous en illimité avec un abonnement Pro. Gérez votre agenda comme un pro."
      />

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
          {stepTitles[step]}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Progress Stepper ───────────────────────────────────────────── */}
      <ProgressStepper currentStep={step} totalSteps={totalSteps} stepLabels={stepLabels} />

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
        {/* ── Step: Select Service (always step 1) ─────────────────────── */}
        {step === 1 && (
          <View style={styles.flex}>
          <ScrollView
            style={styles.flex}
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
                const isSelected = selectedServices.some((s) => s.id === service.id);
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
                        <View style={[styles.pillRow, { marginTop: spacing.sm, flexWrap: 'wrap', rowGap: spacing.xs }]}>
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
                              {formatPrice(isSelected ? effFor(service).price : service.price)}
                            </Text>
                          </View>

                          {/* Variations indicator */}
                          {serviceHasChoices(service) && (
                            <View
                              style={[
                                styles.pill,
                                {
                                  backgroundColor: colors.surfaceSecondary,
                                  borderRadius: radius.full,
                                  paddingHorizontal: spacing.sm,
                                  paddingVertical: spacing.xs,
                                  marginLeft: spacing.sm,
                                },
                              ]}
                            >
                              <Ionicons name="options-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                              <Text variant="caption" color="textSecondary">Variantes</Text>
                            </View>
                          )}
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

                      {/* Add / selected indicator */}
                      <View style={styles.serviceChevron}>
                        <Ionicons
                          name={
                            isSelected
                              ? 'checkmark-circle'
                              : serviceHasChoices(service)
                                ? 'chevron-forward'
                                : 'add-circle-outline'
                          }
                          size={24}
                          color={isSelected ? colors.primary : colors.textMuted}
                        />
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>

          {selectedServices.length > 0 && (
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
              {selectedServices.length > 1 && (
                <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
                  {selectedServices.length} prestations · {totalServiceDuration} min · {formatPrice(totalServicePrice)}
                </Text>
              )}
              <Button
                title={selectedServices.length > 1 ? `Continuer — ${selectedServices.length} prestations` : 'Continuer'}
                variant="primary"
                size="lg"
                onPress={proceedFromServices}
                fullWidth
                leftIcon={<Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
              />
            </View>
          )}
          </View>
        )}

        {/* ── Step: Select Member (only when multiple members) ──────────── */}
        {needsMemberStep && step === STEP_MEMBER && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {loadingNextAvail && (
              <View style={styles.loaderContainerSmall}>
                <Loader />
                <Text variant="body" color="textSecondary" style={{ marginTop: spacing.md }}>
                  Recherche des disponibilités...
                </Text>
              </View>
            )}
            {!loadingNextAvail && activeMembers.map((member) => {
              const isSelected = selectedMemberId === member.id;
              const nextAvail = nextAvailByMember[member.id];

              // Format next availability
              let nextAvailLabel: string;
              if (nextAvail) {
                const d = new Date(nextAvail);
                const dayName = DAYS[d.getDay()];
                const dayNum = d.getDate();
                const monthName = MONTHS[d.getMonth()];
                const hours = d.getHours().toString().padStart(2, '0');
                const mins = d.getMinutes().toString().padStart(2, '0');
                nextAvailLabel = `${capitalize(dayName)} ${dayNum} ${monthName} à ${hours}:${mins}`;
              } else {
                nextAvailLabel = 'Aucune disponibilité prochaine';
              }

              return (
                <Card
                  key={member.id}
                  padding="lg"
                  shadow="sm"
                  onPress={() => nextAvail ? handleSelectMember(member.id) : undefined}
                  style={{
                    marginBottom: spacing.md,
                    opacity: nextAvail ? 1 : 0.5,
                    ...(isSelected
                      ? {
                          backgroundColor: colors.primaryLight,
                          borderColor: colors.primary,
                        }
                      : {}),
                  }}
                >
                  <View style={styles.memberCardContent}>
                    <Avatar name={member.name} size="md" />
                    <View style={styles.memberCardInfo}>
                      <Text variant="h3">{member.name}</Text>
                      <View style={[styles.nextAvailRow, { marginTop: spacing.xs }]}>
                        <Ionicons
                          name={nextAvail ? 'calendar-outline' : 'close-circle-outline'}
                          size={13}
                          color={nextAvail ? colors.success : colors.textMuted}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          variant="caption"
                          color={nextAvail ? 'success' : 'textMuted'}
                          style={{ fontWeight: '500' }}
                        >
                          {nextAvailLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.serviceChevron}>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </View>
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        )}

        {/* ── Step: Select Date & Time ──────────────────────────────────── */}
        {step === STEP_TIMESLOT && (
          <View style={styles.flex}>
            {/* Calendar strip */}
            <View style={{ paddingVertical: spacing.md }}>
              <CalendarStrip
                selectedDate={selectedDate}
                onSelectDate={handleDateChange}
                closedDays={memberClosedDays}
              />
            </View>

            {/* Time slots */}
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingHorizontal: spacing.lg, paddingBottom: selectedSlot ? 120 : spacing['3xl'] }]}
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

        {/* ── Step: Client Info ────────────────────────────────────────── */}
        {step === STEP_CLIENT && (
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
                  onChangeText={(v) => {
                    setClientName(v);
                    setClientQueryField('name');
                  }}
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
                <ClientSuggestionPanel
                  clients={providerClients}
                  queryField={clientQueryField}
                  name={clientName}
                  email={clientEmail}
                  phone={clientPhone}
                  onPick={handlePickClient}
                  colors={colors}
                  spacing={spacing}
                  radius={radius}
                />
              </View>

              <View style={{ marginBottom: spacing.lg }}>
                <Input
                  label="Email *"
                  value={clientEmail}
                  onChangeText={(v) => {
                    setClientEmail(v);
                    setClientQueryField('email');
                  }}
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
                  onChangeText={(v) => {
                    setClientPhone(v);
                    setClientQueryField('phone');
                  }}
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

        {/* ── Step: Confirmation ──────────────────────────────────────── */}
        {step === STEP_CONFIRM && selectedService && selectedSlot && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Receipt-style card */}
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              {/* Service name + price header (count when multi) */}
              <View style={styles.receiptHeader}>
                <Text variant="h2" style={styles.receiptServiceName}>
                  {selectedServices.length > 1
                    ? `${selectedServices.length} prestations`
                    : selectedService.name}
                </Text>
                <Text
                  variant="h2"
                  color="primary"
                  style={{ fontWeight: '700' }}
                >
                  {formatPrice(totalServicePrice)}
                </Text>
              </View>

              {/* Per-prestation breakdown (multi only) */}
              {selectedServices.length > 1 && (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  {selectedServices.map((s, idx) => (
                    <View
                      key={s.id}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}
                    >
                      <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
                        {idx + 1}. {s.name}
                      </Text>
                      <Text variant="bodySmall" color="textSecondary">
                        {effFor(s).duration} min · {formatPrice(effFor(s).price)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

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
                    <Text variant="body">{totalServiceDuration} min</Text>
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

      {/* ── Variations / options picker (service with choices) ── */}
      <Modal
        visible={pendingChoiceService !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPendingChoiceService(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.divider,
            }}
          >
            <Pressable
              onPress={() => setPendingChoiceService(null)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
              <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
                {pendingChoiceService?.name}
              </Text>
            </Pressable>
            <Pressable onPress={() => setPendingChoiceService(null)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          {pendingChoiceService && (
            <ServiceChoicesPreview
              mode="picker"
              confirmLabel="Ajouter"
              onConfirm={(sel) => {
                addServiceToCart(pendingChoiceService, sel);
                setPendingChoiceService(null);
              }}
              service={{
                name: pendingChoiceService.name,
                price: pendingChoiceService.price,
                duration: pendingChoiceService.duration,
                photoURL: pendingChoiceService.photoURL,
                variations: pendingChoiceService.variations ?? [],
                options: pendingChoiceService.options ?? [],
                infoFields: pendingChoiceService.infoFields ?? [],
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
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

  // Step Member — Member card
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nextAvailRow: {
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
