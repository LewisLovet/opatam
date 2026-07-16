/**
 * Pro Planning Screen (file kept as bookings.tsx for routing
 * stability — see _layout.tsx note).
 *
 * Unified timeline of two event kinds:
 *   - Réservations (Booking)         → client-facing, has actions
 *     (confirm/cancel, "demander un avis", payment status, etc.)
 *   - Activités (BlockedSlot.category)→ provider's personal events
 *     (sport, meeting, perso, …) — no client actions, just a
 *     glance at what's on the day
 *
 * Two top-level toggles:
 *   1. View: "À venir" (default) vs. "Passé" — flips the sort
 *      order and constrains the date range. Solves the previous
 *      version's main pain: it was sorted past-first, which buried
 *      tomorrow's RDV at the bottom.
 *   2. Type: Tout / Réservations / Activités — lets the pro focus
 *      on one stream at a time.
 *
 * Status (pending/confirmed/…) and member filters are kept but
 * only relevant for bookings — they're hidden when the user picks
 * "Activités".
 */

import type { WithId } from '@booking-app/firebase';
import { bookingService, memberService, reviewService } from '@booking-app/firebase';
import type {
  Booking,
  BookingStatus,
  Member,
  BlockedSlot,
  ActivityCategory,
} from '@booking-app/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  BookingStatusBadge,
  Loader,
  Text,
} from '../../../components';
import { useAuth, useProvider } from '../../../contexts';
import { API_URL } from '../../../lib/config';
import i18n from '../../../lib/i18n';
import {
  useProviderBookings,
  useProviderActivities,
} from '../../../hooks';
import { useTheme, type Colors } from '../../../theme';
import { ACTIVITY_CATEGORY_META } from '../../../components/business/Activity/categoryMeta';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely convert Firestore Timestamp or Date to Date */
function toDate(dt: any): Date {
  if (dt instanceof Date) return dt;
  if (dt?.toDate) return dt.toDate();
  return new Date(dt);
}

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type PeriodFilter = 'today' | 'week' | 'month' | 'all';
type PlanningView = 'upcoming' | 'past';
type TypeFilter = 'all' | 'bookings' | 'activities';

interface StatusOption {
  labelKey: string;
  value: BookingStatus | undefined;
}

interface PeriodOption {
  labelKey: string;
  value: PeriodFilter;
}

interface ViewOption {
  labelKey: string;
  value: PlanningView;
}

interface TypeOption {
  labelKey: string;
  value: TypeFilter;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const STATUS_OPTIONS: StatusOption[] = [
  { labelKey: 'proBookings.filters.status.all', value: undefined },
  { labelKey: 'proBookings.filters.status.pending', value: 'pending' },
  { labelKey: 'proBookings.filters.status.confirmed', value: 'confirmed' },
  { labelKey: 'proBookings.filters.status.cancelled', value: 'cancelled' },
  { labelKey: 'proBookings.filters.status.noshow', value: 'noshow' },
];

const PERIOD_OPTIONS: PeriodOption[] = [
  { labelKey: 'proBookings.filters.period.day', value: 'today' },
  { labelKey: 'proBookings.filters.period.week', value: 'week' },
  { labelKey: 'proBookings.filters.period.month', value: 'month' },
  { labelKey: 'proBookings.filters.period.all', value: 'all' },
];

const VIEW_OPTIONS: ViewOption[] = [
  { labelKey: 'proBookings.view.upcoming', value: 'upcoming' },
  { labelKey: 'proBookings.view.past', value: 'past' },
];

const TYPE_OPTIONS: TypeOption[] = [
  { labelKey: 'proBookings.filters.type.all', value: 'all', icon: 'apps-outline' },
  { labelKey: 'proBookings.filters.type.bookings', value: 'bookings', icon: 'people-outline' },
  { labelKey: 'proBookings.filters.type.activities', value: 'activities', icon: 'calendar-outline' },
];

/**
 * Tagged union the SectionList renders. `date` is the start instant
 * we sort by — `datetime` for bookings, `startDate` (with
 * `startTime` parsed in) for activities.
 */
type PlanningEvent =
  | { kind: 'booking'; date: Date; data: WithId<Booking> }
  | { kind: 'activity'; date: Date; data: WithId<BlockedSlot> };

/** Window covering everything ±1 year — used as the data fetch
 *  upper bound when the user picks "Tout" so we don't pull every
 *  booking ever made. */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Date Helpers
// ---------------------------------------------------------------------------

/**
 * Returns start and end Date for a given period — covers the full
 * window (today, this week, this month, all). The view toggle
 * (À venir / Passé) further slices this client-side; we don't push
 * "now" into the query bounds because then changing the toggle
 * would re-fetch unnecessarily.
 *
 * "Tout" is capped at ±1 year. Without a cap we'd pull the entire
 * history every render, which is wasteful for established providers.
 */
function getDateRange(period: PeriodFilter): { startDate?: Date; endDate?: Date } {
  const now = new Date();

  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { startDate: monday, endDate: sunday };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate: start, endDate: end };
    }
    case 'all':
    default:
      return {
        startDate: new Date(now.getTime() - ONE_YEAR_MS),
        endDate: new Date(now.getTime() + ONE_YEAR_MS),
      };
  }
}

/**
 * Parse the start instant of an activity. Two cases handled:
 *   - allDay → midnight of `startDate`
 *   - timed  → startDate + parsed startTime (HH:MM string)
 *
 * Falls back to `startDate` raw if parsing the time string fails;
 * the worst that can happen visually is a slot landing at 00:00,
 * which is still better than the screen crashing.
 */
function activityStartInstant(slot: BlockedSlot): Date {
  const base = slot.startDate instanceof Date ? slot.startDate : new Date(slot.startDate as any);
  if (slot.allDay || !slot.startTime) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  }
  const [hh, mm] = slot.startTime.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return base;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
}

/** Same idea for the end instant — used to compute durations. */
function activityEndInstant(slot: BlockedSlot): Date {
  const base = slot.endDate instanceof Date ? slot.endDate : new Date(slot.endDate as any);
  if (slot.allDay || !slot.endTime) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
  }
  const [hh, mm] = slot.endTime.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return base;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
}

/** Formats a Date as "HH" (hours only) */
function formatHour(date: Date): string {
  return date.getHours().toString().padStart(2, '0');
}

/** Formats a Date as "mm" (minutes only) */
function formatMinutes(date: Date): string {
  return date.getMinutes().toString().padStart(2, '0');
}

/** Duration display helper */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h${remaining}`;
}

/** Locale for date formatting, following the current app language */
function dateLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR';
}

/** Format a date into a section header label */
function formatSectionDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return i18n.t('dates.today');
  if (diffDays === 1) return i18n.t('dates.tomorrow');
  if (diffDays === -1) return i18n.t('dates.yesterday');

  const label = date.toLocaleDateString(dateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Get a date key for grouping (YYYY-MM-DD) */
function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

/** Get status accent color for left border */
function getStatusAccentColor(status: BookingStatus | string, colors: Colors): string {
  switch (status) {
    case 'confirmed':
      return colors.success;
    case 'pending':
      return colors.warning;
    case 'cancelled':
      return colors.textMuted;
    case 'noshow':
      return colors.error;
    default:
      return colors.border;
  }
}

/** Get status dot color */
function getStatusDotColor(status: BookingStatus | string, colors: Colors): string {
  switch (status) {
    case 'confirmed':
      return colors.success;
    case 'pending':
      return colors.warning;
    case 'cancelled':
      return colors.textMuted;
    case 'noshow':
      return colors.error;
    default:
      return colors.border;
  }
}

// ---------------------------------------------------------------------------
// Section data type
// ---------------------------------------------------------------------------

interface PlanningSection {
  title: string;
  date: Date;
  data: PlanningEvent[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProBookingsScreen() {
  const { colors, spacing, radius, shadows } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { providerId } = useProvider();
  const { user } = useAuth();

  // -- Filter state ----------------------------------------------------------

  const [view, setView] = useState<PlanningView>('upcoming');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');
  const [memberFilter, setMemberFilter] = useState<string | undefined>(undefined);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // -- Date range (derived from period) --------------------------------------
  // The view toggle (upcoming/past) is applied *after* the fetch
  // by slicing the timeline at "now" — see the `events` memo. That
  // way switching upcoming↔past is instant (no extra Firestore round
  // trip) and the period chips keep their semantic meaning ("this
  // week" = the entire current week, before and after now).

  const { startDate, endDate } = useMemo(() => getDateRange(periodFilter), [periodFilter]);

  // -- Fetch bookings + activities -------------------------------------------

  const {
    bookings,
    isLoading: bookingsLoading,
    error: bookingsError,
    refresh: refreshBookings,
  } = useProviderBookings({
    providerId,
    // Status filter only applies to bookings, and only when the
    // user hasn't explicitly hidden bookings via the type filter.
    status: typeFilter === 'activities' ? undefined : statusFilter,
    memberId: memberFilter,
    startDate,
    endDate,
  });

  const {
    activities,
    isLoading: activitiesLoading,
    refresh: refreshActivities,
  } = useProviderActivities({
    providerId: providerId ?? null,
    memberId: memberFilter,
    startDate,
    endDate,
  });

  const isLoading = bookingsLoading || activitiesLoading;
  const error = bookingsError;

  const refresh = useCallback(async () => {
    await Promise.all([refreshBookings(), refreshActivities()]);
  }, [refreshBookings, refreshActivities]);

  // -- Load members on mount -------------------------------------------------

  useEffect(() => {
    if (!providerId) return;
    memberService
      .getByProvider(providerId)
      .then((result) => setMembers(result))
      .catch(() => {
        // Silently ignore — member filter simply won't appear
      });
  }, [providerId]);

  // -- Load reviewed clients (to avoid showing "Demander un avis" for clients who already reviewed) --

  const [reviewedClients, setReviewedClients] = useState<Set<string>>(new Set());

  const loadReviewedClients = useCallback(async () => {
    if (!providerId) return;
    try {
      const reviews = await reviewService.getProviderReviews(providerId);
      const ids = new Set<string>();
      for (const review of reviews) {
        if (review.clientId) ids.add(review.clientId);
        if (review.clientEmail) ids.add(review.clientEmail.toLowerCase().trim());
      }
      setReviewedClients(ids);
    } catch {
      // Silently ignore
    }
  }, [providerId]);

  useEffect(() => {
    loadReviewedClients();
  }, [loadReviewedClients]);

  // -- Pending count for badge -----------------------------------------------

  const pendingCount = useMemo(
    () => bookings.filter((b) => b.status === 'pending').length,
    [bookings],
  );

  // -- Merged event timeline grouped by date (sections) ----------------------
  //
  // Steps:
  //   1. Tag each booking / activity with `kind` and a sort `date`.
  //   2. Apply the type filter (Tout / Réservations / Activités).
  //   3. Slice on "now" based on the view toggle (upcoming/past).
  //   4. Sort: upcoming → ascending (sooner first); past → descending
  //      (most recent first), matching how a person scans either
  //      direction of a timeline.
  //   5. Group by date key and emit a list of sections.

  const sections: PlanningSection[] = useMemo(() => {
    const now = Date.now();

    const bookingEvents: PlanningEvent[] =
      typeFilter === 'activities'
        ? []
        : bookings.map((b) => ({
            kind: 'booking',
            data: b,
            date: toDate(b.datetime),
          }));

    const activityEvents: PlanningEvent[] =
      typeFilter === 'bookings'
        ? []
        : activities.map((a) => ({
            kind: 'activity',
            data: a,
            date: activityStartInstant(a),
          }));

    const merged = [...bookingEvents, ...activityEvents];

    // View slice. Strict comparison with `now` so an event happening
    // exactly at the current minute lands in "À venir" — matches user
    // intuition ("c'est dans 0 minute" = upcoming, not past).
    const sliced = merged.filter((e) =>
      view === 'upcoming' ? e.date.getTime() >= now : e.date.getTime() < now,
    );

    sliced.sort((a, b) =>
      view === 'upcoming'
        ? a.date.getTime() - b.date.getTime()
        : b.date.getTime() - a.date.getTime(),
    );

    const grouped: Record<string, { date: Date; items: PlanningEvent[] }> = {};
    for (const evt of sliced) {
      const key = getDateKey(evt.date);
      if (!grouped[key]) grouped[key] = { date: evt.date, items: [] };
      grouped[key].items.push(evt);
    }

    return Object.entries(grouped)
      .sort(([a], [b]) =>
        view === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a),
      )
      .map(([, group]) => ({
        title: formatSectionDate(group.date),
        date: group.date,
        data: group.items,
      }));
    // `t` keeps section titles in sync with the current language.
  }, [bookings, activities, view, typeFilter, t]);

  // -- Booking actions -------------------------------------------------------

  const handleConfirm = useCallback(
    async (bookingId: string) => {
      if (!user) return;
      try {
        await bookingService.confirmBooking(bookingId, user.uid);
        await refresh();
      } catch {
        Alert.alert(
          i18n.t('proBookings.alerts.errorTitle'),
          i18n.t('proBookings.alerts.confirmError'),
        );
      }
    },
    [user, refresh],
  );

  const handleCancel = useCallback(
    (bookingId: string) => {
      Alert.alert(
        i18n.t('proBookings.alerts.cancelTitle'),
        i18n.t('proBookings.alerts.cancelMessage'),
        [
          { text: i18n.t('proBookings.alerts.no'), style: 'cancel' },
          {
            text: i18n.t('proBookings.alerts.yesCancel'),
            style: 'destructive',
            onPress: async () => {
              if (!user) return;
              try {
                await bookingService.cancelBooking(bookingId, 'provider', user.uid);
                await refresh();
              } catch {
                Alert.alert(
                  i18n.t('proBookings.alerts.errorTitle'),
                  i18n.t('proBookings.alerts.cancelError'),
                );
              }
            },
          },
        ],
      );
    },
    [user, refresh],
  );

  const [reviewRequestLoadingId, setReviewRequestLoadingId] = useState<string | null>(null);

  const handleReviewRequest = useCallback(
    async (bookingId: string) => {
      setReviewRequestLoadingId(bookingId);
      try {
        // Always call the production API to send the review request email
        const response = await fetch(`${API_URL}/api/bookings/review-request-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || i18n.t('proBookings.alerts.reviewRequestSendError'));
        }
        Alert.alert(
          i18n.t('proBookings.alerts.successTitle'),
          i18n.t('proBookings.alerts.reviewRequestSent'),
        );
        await refresh();
      } catch (error: any) {
        Alert.alert(
          i18n.t('proBookings.alerts.errorTitle'),
          error.message || i18n.t('proBookings.alerts.reviewRequestError'),
        );
      } finally {
        setReviewRequestLoadingId(null);
      }
    },
    [refresh],
  );

  const navigateToBooking = useCallback(
    (bookingId: string) => {
      router.push(`/(pro)/booking-detail/${bookingId}`);
    },
    [router],
  );

  // -- Render helpers --------------------------------------------------------

  const renderSectionHeader = useCallback(
    ({ section }: { section: PlanningSection }) => (
      <View
        style={[
          styles.sectionHeader,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.sm,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.sectionHeaderInner}>
          <Text
            variant="caption"
            style={[
              styles.sectionTitle,
              { color: colors.textSecondary },
            ]}
          >
            {section.title.toUpperCase()}
          </Text>
          <View
            style={[
              styles.sectionLine,
              { backgroundColor: colors.divider, marginLeft: spacing.md },
            ]}
          />
        </View>
      </View>
    ),
    [colors, spacing],
  );

  /** Check if a booking's client has already left a review */
  const hasClientReviewed = useCallback(
    (booking: WithId<Booking>): boolean => {
      if (reviewedClients.size === 0) return false;
      if (booking.clientId && reviewedClients.has(booking.clientId)) return true;
      const email = booking.clientInfo?.email?.toLowerCase().trim();
      if (email && reviewedClients.has(email)) return true;
      return false;
    },
    [reviewedClients],
  );

  /**
   * Render a single booking row. Pulled into its own callback
   * (separate from the union-event router below) because it
   * carries a lot of internal state — pending actions, review
   * states — that we don't want to hydrate for every activity.
   */
  const renderBookingCard = useCallback(
    (booking: WithId<Booking>) => {
      const bookingDate = toDate(booking.datetime);
      const hour = formatHour(bookingDate);
      const minutes = formatMinutes(bookingDate);
      const status = booking.status as BookingStatus;
      const accentColor = getStatusAccentColor(status, colors);
      const dotColor = getStatusDotColor(status, colors);
      const isPending = status === 'pending';
      const isPastConfirmed = status === 'confirmed' && bookingDate < new Date();
      const clientAlreadyReviewed = isPastConfirmed && hasClientReviewed(booking);

      return (
        <Pressable
          onPress={() => navigateToBooking(booking.id)}
          style={({ pressed }) => [
            styles.bookingCard,
            {
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 3,
              borderLeftColor: booking.memberColor || accentColor,
              ...shadows.sm,
            },
          ]}
        >
          <View
            style={[
              styles.bookingCardInner,
              { padding: spacing.md },
            ]}
          >
            {/* Left: Time column */}
            <View style={[styles.timeColumn, { marginRight: spacing.md }]}>
              <Text variant="h3" style={styles.timeHour}>
                {hour}
              </Text>
              <Text variant="caption" color="textMuted" style={styles.timeMinutes}>
                {minutes}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: dotColor,
                    marginTop: spacing.xs,
                  },
                ]}
              />
            </View>

            {/* Center: Client + Service info */}
            <View style={styles.centerColumn}>
              <View style={[styles.clientRow, { gap: spacing.sm }]}>
                <Avatar size="sm" name={booking.clientInfo.name} />
                <View style={styles.clientInfo}>
                  <Text variant="body" numberOfLines={1} style={styles.clientName}>
                    {booking.clientInfo.name}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {booking.serviceName}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right: Duration + Status badge */}
            <View style={[styles.rightColumn, { gap: spacing.xs }]}>
              <View
                style={[
                  styles.durationBadge,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                  },
                ]}
              >
                <Text variant="caption" color="textSecondary">
                  {formatDuration(booking.duration)}
                </Text>
              </View>
              <BookingStatusBadge
                status={status as 'pending' | 'confirmed' | 'cancelled' | 'noshow'}
                size="sm"
              />
            </View>
          </View>

          {/* Quick actions for pending bookings */}
          {isPending && (
            <View
              style={[
                styles.quickActionsRow,
                {
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  gap: spacing.sm,
                },
              ]}
            >
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleConfirm(booking.id);
                }}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  {
                    borderWidth: 1,
                    borderColor: pressed ? colors.successDark : colors.success,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: pressed ? colors.successLight : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={16}
                  color={colors.success}
                  style={{ marginRight: spacing.xs }}
                />
                <Text variant="caption" style={{ color: colors.success, fontWeight: '600' }}>
                  {t('common.confirm')}
                </Text>
              </Pressable>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleCancel(booking.id);
                }}
                style={({ pressed }) => [
                  styles.quickActionButton,
                  {
                    borderWidth: 0,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginRight: spacing.xs }}
                />
                <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                  {t('proBookings.card.decline')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Review already received indicator */}
          {isPastConfirmed && clientAlreadyReviewed && (
            <View
              style={[
                styles.quickActionsRow,
                {
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons
                name="star"
                size={14}
                color="#f59e0b"
                style={{ marginRight: spacing.xs }}
              />
              <Text variant="caption" style={{ fontWeight: '500', color: '#f59e0b' }}>
                {t('proBookings.card.reviewReceived')}
              </Text>
            </View>
          )}

          {/* Review request for past confirmed bookings (only if no review yet) */}
          {isPastConfirmed && !clientAlreadyReviewed && !booking.reviewRequestSentAt && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleReviewRequest(booking.id);
              }}
              disabled={reviewRequestLoadingId === booking.id}
              style={({ pressed }) => [
                styles.quickActionsRow,
                {
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  justifyContent: 'center',
                  backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                },
              ]}
            >
              {reviewRequestLoadingId === booking.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name="mail-outline"
                    size={16}
                    color={colors.primary}
                    style={{ marginRight: spacing.xs }}
                  />
                  <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
                    {t('proBookings.card.requestReview')}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Review request already sent indicator (only if no review yet) */}
          {isPastConfirmed && !clientAlreadyReviewed && !!booking.reviewRequestSentAt && (
            <View
              style={[
                styles.quickActionsRow,
                {
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  justifyContent: 'center',
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.success}
                style={{ marginRight: spacing.xs }}
              />
              <Text variant="caption" color="textMuted" style={{ fontWeight: '500' }}>
                {t('proBookings.card.reviewRequestSentLabel')}
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [colors, spacing, radius, shadows, navigateToBooking, handleConfirm, handleCancel, handleReviewRequest, reviewRequestLoadingId, hasClientReviewed],
  );

  /**
   * Render an activity row. Compact: time, category icon + colour
   * stripe, title, optional address & member. Tap routes to the
   * existing detail-by-id editor (we reuse the same flow that the
   * calendar uses).
   */
  const renderActivityCard = useCallback(
    (slot: WithId<BlockedSlot>) => {
      const start = activityStartInstant(slot);
      const end = activityEndInstant(slot);
      const meta = slot.category ? ACTIVITY_CATEGORY_META[slot.category] : null;
      const accent = meta?.color ?? colors.border;

      const timeLabel = slot.allDay
        ? t('proBookings.activity.allDay')
        : `${formatHour(start)}h${formatMinutes(start)}`;
      const durationMinutes = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / 60000),
      );

      return (
        <Pressable
          // Same destination as the calendar tab's activity tap —
          // /create-activity is also the edit screen when an `id`
          // query param is passed (it hydrates the form from the
          // existing slot). Reusing it means a single editor exists
          // for both creation and editing, which is what we want
          // until we ever build a read-only detail screen.
          onPress={() =>
            router.push(`/(pro)/create-activity?id=${slot.id}` as any)
          }
          style={({ pressed }) => [
            styles.bookingCard,
            {
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 3,
              borderLeftColor: accent,
              ...shadows.sm,
            },
          ]}
        >
          <View style={[styles.bookingCardInner, { padding: spacing.md }]}>
            {/* Left: Time column */}
            <View style={[styles.timeColumn, { marginRight: spacing.md }]}>
              {slot.allDay ? (
                <Ionicons name="sunny-outline" size={20} color={accent} />
              ) : (
                <>
                  <Text variant="h3" style={styles.timeHour}>
                    {formatHour(start)}
                  </Text>
                  <Text variant="caption" color="textMuted" style={styles.timeMinutes}>
                    {formatMinutes(start)}
                  </Text>
                </>
              )}
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: accent, marginTop: spacing.xs },
                ]}
              />
            </View>

            {/* Center: title + category + optional address */}
            <View style={styles.centerColumn}>
              <View style={[styles.clientRow, { gap: spacing.sm }]}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: accent + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {meta ? (
                    <Ionicons name={meta.icon} size={16} color={accent} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={16} color={accent} />
                  )}
                </View>
                <View style={styles.clientInfo}>
                  <Text variant="body" numberOfLines={1} style={styles.clientName}>
                    {slot.title || meta?.label || t('proBookings.activity.fallback')}
                  </Text>
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {meta?.label ?? t('proBookings.activity.fallback')}
                    {slot.address ? ` · ${slot.address}` : ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right: time label + duration */}
            <View style={[styles.rightColumn, { gap: spacing.xs }]}>
              <View
                style={[
                  styles.durationBadge,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                  },
                ]}
              >
                <Text variant="caption" color="textSecondary">
                  {slot.allDay
                    ? timeLabel
                    : durationMinutes > 0
                      ? formatDuration(durationMinutes)
                      : timeLabel}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [colors, spacing, radius, shadows, router, t],
  );

  /**
   * SectionList item router — picks the booking or activity
   * renderer based on the tagged-union event kind.
   */
  const renderEventItem = useCallback(
    ({ item }: { item: PlanningEvent }) =>
      item.kind === 'booking'
        ? renderBookingCard(item.data)
        : renderActivityCard(item.data),
    [renderBookingCard, renderActivityCard],
  );

  const renderEmpty = useCallback(
    () => (
      <View
        style={{
          padding: spacing.lg,
          paddingTop: spacing['4xl'],
          alignItems: 'center',
        }}
      >
        <View
          style={{
            marginBottom: spacing.xl,
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="calendar-clear-outline"
            size={48}
            color={colors.primary}
            style={{ opacity: 0.6 }}
          />
        </View>
        <Text variant="h3" align="center" style={{ marginBottom: spacing.xs }}>
          {view === 'upcoming'
            ? t('proBookings.empty.upcomingTitle')
            : t('proBookings.empty.pastTitle')}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {view === 'upcoming'
            ? t('proBookings.empty.upcomingDescription')
            : t('proBookings.empty.pastDescription')}
        </Text>
      </View>
    ),
    [spacing, colors, view, t],
  );

  const renderListHeader = useCallback(
    () => (
      <View style={{ paddingTop: spacing.md }}>
        {/* ── À venir / Passé toggle ──────────────────────────────── */}
        <View
          style={[
            styles.segmentedControl,
            {
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: 3,
            },
          ]}
        >
          {VIEW_OPTIONS.map((option) => {
            const isActive = view === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setView(option.value);
                }}
                style={[
                  styles.segmentedItem,
                  {
                    backgroundColor: isActive ? colors.surface : 'transparent',
                    borderRadius: radius.md,
                    paddingVertical: spacing.sm,
                    ...(isActive ? shadows.sm : {}),
                  },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    color: isActive ? colors.text : colors.textSecondary,
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Type filter (Tout / Réservations / Activités) ──────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}
        >
          {TYPE_OPTIONS.map((option) => {
            const isActive = typeFilter === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setTypeFilter(option.value);
                }}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    minHeight: 36,
                    gap: spacing.xs,
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={14}
                  color={isActive ? colors.textInverse : colors.textSecondary}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: isActive ? colors.textInverse : colors.text,
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Status filter pills (only meaningful for bookings —
              hidden when "Activités" is the type filter) ─────────── */}
        {typeFilter !== 'activities' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}
        >
          {STATUS_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            const showBadge = option.value === 'pending' && pendingCount > 0;

            return (
              <Pressable
                key={t(option.labelKey)}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setStatusFilter(option.value);
                }}
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    minHeight: 36,
                  },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    color: isActive ? colors.textInverse : colors.text,
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {t(option.labelKey)}
                </Text>
                {showBadge && (
                  <View
                    style={[
                      styles.countBadge,
                      {
                        backgroundColor: isActive ? colors.textInverse : colors.warning,
                        borderRadius: radius.full,
                        marginLeft: spacing.xs,
                        minWidth: 20,
                        height: 20,
                        paddingHorizontal: spacing.xs,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        color: isActive ? colors.primary : colors.textInverse,
                        fontWeight: '700',
                        fontSize: 11,
                      }}
                    >
                      {pendingCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        )}

        {/* ── Separator ────────────────────────────────────────────── */}
        <View
          style={[
            styles.separator,
            {
              backgroundColor: colors.divider,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
            },
          ]}
        />

        {/* ── Period filter (segmented control) ───────────────────── */}
        <View
          style={[
            styles.segmentedControl,
            {
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              padding: 3,
            },
          ]}
        >
          {PERIOD_OPTIONS.map((option) => {
            const isActive = periodFilter === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPeriodFilter(option.value);
                }}
                style={[
                  styles.segmentedItem,
                  {
                    backgroundColor: isActive ? colors.surface : 'transparent',
                    borderRadius: radius.md,
                    paddingVertical: spacing.sm,
                    ...(isActive ? shadows.sm : {}),
                  },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    color: isActive ? colors.text : colors.textSecondary,
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {t(option.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Member filter (only if multiple members) ────────────── */}
        {members.length > 1 && (
          <>
            <View
              style={[
                styles.separator,
                {
                  backgroundColor: colors.divider,
                  marginHorizontal: spacing.lg,
                  marginBottom: spacing.md,
                },
              ]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.sm }}
              contentContainerStyle={{
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
              }}
            >
              {/* "Tous" member pill */}
              <Pressable
                onPress={() => setMemberFilter(undefined)}
                style={[
                  styles.memberPill,
                  {
                    backgroundColor:
                      memberFilter === undefined ? colors.primaryLight : colors.surface,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderWidth: 1.5,
                    borderColor:
                      memberFilter === undefined ? colors.primary : colors.border,
                    minHeight: 40,
                  },
                ]}
              >
                <View
                  style={[
                    styles.memberAllIcon,
                    {
                      width: 24,
                      height: 24,
                      borderRadius: radius.full,
                      backgroundColor:
                        memberFilter === undefined
                          ? colors.primary
                          : colors.surfaceSecondary,
                      marginRight: spacing.xs,
                    },
                  ]}
                >
                  <Ionicons
                    name="people"
                    size={14}
                    color={
                      memberFilter === undefined
                        ? colors.textInverse
                        : colors.textMuted
                    }
                  />
                </View>
                <Text
                  variant="bodySmall"
                  style={{
                    color:
                      memberFilter === undefined ? colors.primary : colors.text,
                    fontWeight: memberFilter === undefined ? '600' : '400',
                  }}
                >
                  {t('proBookings.filters.member.all')}
                </Text>
              </Pressable>

              {/* Individual member pills */}
              {members.map((member) => {
                const isActive = memberFilter === member.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => setMemberFilter(member.id)}
                    style={[
                      styles.memberPill,
                      {
                        backgroundColor: isActive
                          ? colors.primaryLight
                          : colors.surface,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderWidth: 1.5,
                        borderColor: isActive ? colors.primary : colors.border,
                        minHeight: 40,
                      },
                    ]}
                  >
                    <Avatar
                      size="sm"
                      name={member.name}
                      color={member.color}
                      style={{
                        width: 24,
                        height: 24,
                        marginRight: spacing.xs,
                      }}
                    />
                    <Text
                      variant="bodySmall"
                      style={{
                        color: isActive ? colors.primary : colors.text,
                        fontWeight: isActive ? '600' : '400',
                      }}
                    >
                      {member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    ),
    [
      colors,
      spacing,
      radius,
      shadows,
      view,
      typeFilter,
      statusFilter,
      periodFilter,
      memberFilter,
      members,
      pendingCount,
      t,
    ],
  );

  // -- Loading state ---------------------------------------------------------

  if (isLoading && bookings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.brandedHeader, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('proBookings.title')}</Text>
          </View>
        </View>
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      </View>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ────────────────────────────────────────── */}
      <View style={[styles.brandedHeader, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('proBookings.title')}</Text>
        </View>
      </View>

      <SectionList<PlanningEvent, PlanningSection>
        sections={sections}
        // Booking ids and BlockedSlot ids share the same Firestore
        // shape (string), but a collision is theoretically possible
        // — prefix with the kind so React's keying is unambiguous.
        keyExtractor={(item) =>
          item.kind === 'booking' ? `b:${item.data.id}` : `a:${item.data.id}`
        }
        renderItem={renderEventItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => { refresh(); loadReviewedClients(); }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  // Branded header
  brandedHeader: {},

  // Header (legacy)
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Status pills
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Separator
  separator: {
    height: 1,
  },

  // Segmented control
  segmentedControl: {
    flexDirection: 'row',
  },
  segmentedItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Member pills
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAllIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section headers
  sectionHeader: {},
  sectionHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    letterSpacing: 0.5,
    fontWeight: '600',
    fontSize: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  // Booking card
  bookingCard: {
    overflow: 'hidden',
  },
  bookingCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeColumn: {
    width: 44,
    alignItems: 'center',
  },
  timeHour: {
    fontWeight: '700',
  },
  timeMinutes: {
    fontWeight: '500',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  centerColumn: {
    flex: 1,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontWeight: '600',
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  durationBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
});
