/**
 * Pro Bookings List Screen
 * Full bookings list with status, period, and member filters.
 * Redesigned with grouped sections, accent borders, and polished filter UI.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  RefreshControl,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type Colors } from '../../../theme';
import {
  Text,
  Loader,
  Avatar,
  BookingStatusBadge,
} from '../../../components';
import { useProvider, useAuth } from '../../../contexts';
import { useProviderBookings } from '../../../hooks';
import { memberService, bookingService, reviewService } from '@booking-app/firebase';
import type { WithId } from '@booking-app/firebase';
import type { BookingStatus, Member, Booking } from '@booking-app/shared';

const API_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000';
const PRODUCTION_URL = 'https://opatam.com';

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

interface StatusOption {
  label: string;
  value: BookingStatus | undefined;
}

interface PeriodOption {
  label: string;
  value: PeriodFilter;
}

const STATUS_OPTIONS: StatusOption[] = [
  { label: 'Tous', value: undefined },
  { label: 'En attente', value: 'pending' },
  { label: 'Confirmés', value: 'confirmed' },
  { label: 'Annulés', value: 'cancelled' },
  { label: 'No-show', value: 'noshow' },
];

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'Jour', value: 'today' },
  { label: 'Semaine', value: 'week' },
  { label: 'Mois', value: 'month' },
  { label: 'Tout', value: 'all' },
];

// ---------------------------------------------------------------------------
// Date Helpers
// ---------------------------------------------------------------------------

/** Returns start and end Date for a given period filter */
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
      return {};
  }
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

// French day and month names for section headers
const FRENCH_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Format a date into a section header label */
function formatSectionDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays === -1) return 'Hier';

  const dayName = FRENCH_DAYS[date.getDay()];
  const dayNum = date.getDate();
  const monthName = FRENCH_MONTHS[date.getMonth()];
  return `${dayName} ${dayNum} ${monthName}`;
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

interface BookingSection {
  title: string;
  date: Date;
  data: WithId<Booking>[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProBookingsScreen() {
  const { colors, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { providerId } = useProvider();
  const { user } = useAuth();

  // -- Filter state ----------------------------------------------------------

  const [statusFilter, setStatusFilter] = useState<BookingStatus | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');
  const [memberFilter, setMemberFilter] = useState<string | undefined>(undefined);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // -- Date range (derived from period) --------------------------------------

  const { startDate, endDate } = useMemo(() => getDateRange(periodFilter), [periodFilter]);

  // -- Fetch bookings --------------------------------------------------------

  const { bookings, isLoading, error, refresh } = useProviderBookings({
    providerId,
    status: statusFilter,
    memberId: memberFilter,
    startDate,
    endDate,
  });

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

  // -- Sorted bookings grouped by date (sections) ----------------------------

  const sections: BookingSection[] = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => {
      const dateA = toDate(a.datetime);
      const dateB = toDate(b.datetime);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });

    const grouped: Record<string, { date: Date; items: WithId<Booking>[] }> = {};
    for (const booking of sorted) {
      const bookingDate = toDate(booking.datetime);
      const key = getDateKey(bookingDate);
      if (!grouped[key]) {
        grouped[key] = { date: bookingDate, items: [] };
      }
      grouped[key].items.push(booking);
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a)) // Most recent date first
      .map(([, group]) => ({
        title: formatSectionDate(group.date),
        date: group.date,
        data: group.items,
      }));
  }, [bookings]);

  // -- Booking actions -------------------------------------------------------

  const handleConfirm = useCallback(
    async (bookingId: string) => {
      if (!user) return;
      try {
        await bookingService.confirmBooking(bookingId, user.uid);
        await refresh();
      } catch {
        Alert.alert('Erreur', 'Impossible de confirmer le rendez-vous.');
      }
    },
    [user, refresh],
  );

  const handleCancel = useCallback(
    (bookingId: string) => {
      Alert.alert(
        'Annuler le rendez-vous',
        'Êtes-vous sûr de vouloir annuler ce rendez-vous ?',
        [
          { text: 'Non', style: 'cancel' },
          {
            text: 'Oui, annuler',
            style: 'destructive',
            onPress: async () => {
              if (!user) return;
              try {
                await bookingService.cancelBooking(bookingId, 'provider', user.uid);
                await refresh();
              } catch {
                Alert.alert('Erreur', "Impossible d'annuler le rendez-vous.");
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
        const response = await fetch(`${PRODUCTION_URL}/api/bookings/review-request-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Erreur lors de l'envoi");
        }
        Alert.alert('Succès', "La demande d'avis a été envoyée par email.");
        await refresh();
      } catch (error: any) {
        Alert.alert('Erreur', error.message || "Impossible d'envoyer la demande d'avis.");
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
    ({ section }: { section: BookingSection }) => (
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

  const renderBookingItem = useCallback(
    ({ item: booking }: { item: WithId<Booking> }) => {
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
              borderLeftColor: accentColor,
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
                  Confirmer
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
                  Refuser
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
                Avis reçu
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
                    Demander un avis
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
                Demande d'avis envoyée
              </Text>
            </View>
          )}
        </Pressable>
      );
    },
    [colors, spacing, radius, shadows, navigateToBooking, handleConfirm, handleCancel, handleReviewRequest, reviewRequestLoadingId, hasClientReviewed],
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
          Aucune réservation
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          Aucune réservation ne correspond aux filtres sélectionnés.
        </Text>
      </View>
    ),
    [spacing, colors],
  );

  const renderListHeader = useCallback(
    () => (
      <View style={{ paddingTop: spacing.md }}>
        {/* ── Status filter pills ─────────────────────────────────── */}
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
                key={option.label}
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
                  {option.label}
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
                  {option.label}
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
                  Tous
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
      statusFilter,
      periodFilter,
      memberFilter,
      members,
      pendingCount,
    ],
  );

  // -- Loading state ---------------------------------------------------------

  if (isLoading && bookings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.brandedHeader, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="h1" style={{ color: '#FFFFFF' }}>Réservations</Text>
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
          <Text variant="h1" style={{ color: '#FFFFFF' }}>Réservations</Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
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
