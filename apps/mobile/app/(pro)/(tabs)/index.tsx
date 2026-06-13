/**
 * Pro Dashboard Screen — Redesigned
 * Premium dashboard with gradient hero, swipeable stat cards, timeline bookings,
 * quick actions, and recent reviews.
 */

import { analyticsService, bookingService } from '@booking-app/firebase';
import { deltaPercent, type PageViewStats, type TrendPoint } from '@booking-app/shared';
import { Sparkline } from '../../../components/stats/Sparkline';
import { WelcomeOverlay } from '../../../components/WelcomeOverlay';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Loader,
  NotificationsDrawer,
  Text,
  TrialReminderBanner,
} from '../../../components';
// Lazy-load StoryShare components — they depend on native modules (react-native-qrcode-svg,
// react-native-view-shot) that may not be available in all builds.
const LazyStoryShareModal = lazy(() =>
  import('../../../components/StoryShare/StoryShareModal').then((m) => ({ default: m.StoryShareModal }))
);
const LazyShareFAB = lazy(() =>
  import('../../../components/StoryShare/ShareFAB').then((m) => ({ default: m.ShareFAB }))
);

/** Error boundary — swallows crashes from native module loading failures.
 *  Resets on each new render cycle (key change) so it can retry. */
class NativeModuleBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: any },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn('[NativeModuleBoundary] Caught error:', error.message);
  }
  componentDidUpdate(prevProps: { resetKey?: any }) {
    // Reset error state when resetKey changes (e.g. modal re-opened)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
import { useAuth, useProvider, useSubscriptionStatus } from '../../../contexts';
import {
  useDepositsSummary,
  useProviderDashboard,
  useProviderNotifications,
  useProviderStats,
  useReviews,
} from '../../../hooks';
import {
  MORE_TAB_FEATURE_KEYS,
  useNewFeatures,
  type NewFeatureKey,
} from '../../../hooks/useNewFeatures';
import { useTheme } from '../../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STAT_CARD_WIDTH = SCREEN_WIDTH * 0.75;
const STAT_CARD_MARGIN = 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(dt: any): Date {
  if (dt instanceof Date) return dt;
  if (dt?.toDate) return dt.toDate();
  return new Date(dt);
}

const FRENCH_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FRENCH_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function formatFrenchDate(date: Date): string {
  return `${FRENCH_DAYS[date.getDay()]} ${date.getDate()} ${FRENCH_MONTHS[date.getMonth()]}`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Sum a numeric field of the last N entries of a trend array,
 * optionally offset from the end. Used by the home screen to slice
 * the 30-day trend into a 7d window + a previous-7d window for
 * the delta calculation, without a second hook call.
 */
function sumLast(
  arr: TrendPoint[],
  n: number,
  key: 'revenue' | 'bookingsCount' | 'pageViews',
  offsetFromEnd = 0,
): number {
  if (arr.length === 0) return 0;
  const end = Math.max(0, arr.length - offsetFromEnd);
  const start = Math.max(0, end - n);
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += arr[i][key] ?? 0;
  }
  return sum;
}

function formatPrice(centimes: number): string {
  const euros = centimes / 100;
  return euros % 1 === 0 ? `${euros} €` : `${euros.toFixed(2)} €`;
}

/** Returns "Dans Xh", "Dans X min", or null if booking is in the past */
function getTimeUntilChip(bookingDate: Date): string | null {
  const now = new Date();
  const diffMs = bookingDate.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `Dans ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;
  return remainMin > 0 ? `Dans ${diffH}h${remainMin.toString().padStart(2, '0')}` : `Dans ${diffH}h`;
}

// ---------------------------------------------------------------------------
// Sub-components (inline)
// ---------------------------------------------------------------------------

/** Hero stat chip (semi-transparent capsule) */
function HeroChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroChip}>
      <Ionicons name={icon} size={13} color="rgba(255,255,255,0.9)" />
      <Text variant="caption" style={styles.heroChipText}>{label}</Text>
    </View>
  );
}

/** Quick action button (round icon + label) */
function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.full }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs, textAlign: 'center' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Pagination dots for stat carousel */
function PaginationDots({ count, active }: { count: number; active: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i === active ? colors.primary : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

/** Timeline booking item with colored left bar */
function TimelineBookingItem({
  time,
  clientName,
  serviceName,
  duration,
  status,
  isPast,
  timeChip,
  memberColor,
  price,
  depositPaid,
  onPress,
  onConfirm,
  onCancel,
}: {
  time: string;
  clientName: string;
  serviceName: string;
  duration: number;
  status: string;
  isPast: boolean;
  timeChip: string | null;
  memberColor?: string | null;
  /** Total price of the visit (cents). */
  price: number;
  /** Deposit already paid online (cents), when the booking carries a paid
   *  deposit — null/0 otherwise. The amount still to collect in person is
   *  `price - depositPaid`. */
  depositPaid?: number | null;
  onPress: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  const statusColor = status === 'confirmed' ? colors.success : status === 'pending' ? colors.warning : colors.error;
  const barColor = memberColor || statusColor;

  const hasDeposit = !!depositPaid && depositPaid > 0;
  const remaining = hasDeposit ? Math.max(0, price - (depositPaid as number)) : price;

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const r = min % 60;
    return r === 0 ? `${h}h` : `${h}h${r}`;
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.timelineItem,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
          borderRadius: radius.lg,
          opacity: isPast ? 0.55 : 1,
          marginBottom: spacing.sm,
        },
      ]}
    >
      {/* Color bar */}
      <View style={[styles.timelineBar, { backgroundColor: barColor, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg }]} />

      <View style={[styles.timelineContent, { padding: spacing.md, paddingLeft: spacing.md }]}>
        {/* Row 1: Time + Service + Duration */}
        <View style={styles.timelineRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Text variant="body" style={{ fontWeight: '700', minWidth: 44 }}>{time}</Text>
            <Avatar size="sm" name={clientName} />
            <View style={{ flex: 1 }}>
              <Text variant="body" numberOfLines={1} style={{ fontWeight: '500' }}>{clientName}</Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>{serviceName} · {formatDuration(duration)}</Text>
            </View>
          </View>
          {/* Right cluster: optional "next" chip + amount to collect */}
          {(timeChip || price > 0) && (
            <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: spacing.sm }}>
              {timeChip && (
                <View style={[styles.timeChip, { backgroundColor: colors.primaryLight, borderRadius: radius.full }]}>
                  <Text variant="caption" color="primary" style={{ fontWeight: '600', fontSize: 11 }}>{timeChip}</Text>
                </View>
              )}
              {price > 0 && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="body" style={{ fontWeight: '700' }}>{formatPrice(remaining)}</Text>
                  {hasDeposit ? (
                    <Text variant="caption" style={{ color: colors.success, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
                      acompte {formatPrice(depositPaid as number)} ✓
                    </Text>
                  ) : (
                    <Text variant="caption" color="textMuted" style={{ fontSize: 10 }} numberOfLines={1}>
                      à encaisser
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Pending actions */}
        {status === 'pending' && (onConfirm || onCancel) && (
          <View style={[styles.timelineActions, { marginTop: spacing.sm, gap: spacing.sm }]}>
            {onConfirm && (
              <Pressable
                onPress={onConfirm}
                style={[styles.timelineActionBtn, { backgroundColor: colors.success, borderRadius: radius.md }]}
              >
                <Ionicons name="checkmark" size={14} color="#FFF" />
                <Text variant="caption" style={{ color: '#FFF', fontWeight: '600', marginLeft: 4 }}>Confirmer</Text>
              </Pressable>
            )}
            {onCancel && (
              <Pressable
                onPress={onCancel}
                style={[styles.timelineActionBtn, { backgroundColor: colors.errorLight, borderRadius: radius.md }]}
              >
                <Text variant="caption" color="error" style={{ fontWeight: '600' }}>Refuser</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Stat Cards
// ---------------------------------------------------------------------------

/**
 * DeltaChip — small +/-X% pill used by the modernised stat cards.
 * Green when positive, red when negative, gray on baseline / null
 * (e.g. previous period was 0 so the % is undefined).
 */
function DeltaChip({ delta }: { delta: number | null }) {
  const { colors } = useTheme();
  if (delta === null) {
    return (
      <View style={[styles.deltaChip, { backgroundColor: colors.surfaceSecondary }]}>
        <Text variant="caption" style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>—</Text>
      </View>
    );
  }
  const positive = delta > 0;
  const negative = delta < 0;
  const tone = positive ? colors.success : negative ? colors.error : colors.textMuted;
  return (
    <View
      style={[
        styles.deltaChip,
        { backgroundColor: tone + '18' },
      ]}
    >
      <Ionicons
        name={positive ? 'arrow-up' : negative ? 'arrow-down' : 'remove'}
        size={9}
        color={tone}
      />
      <Text variant="caption" style={{ fontSize: 10, color: tone, fontWeight: '700' }}>
        {delta > 0 ? '+' : ''}{delta}%
      </Text>
    </View>
  );
}

function StatCardToday({
  bookingsCount,
  revenue,
  passedCount,
  onPress,
}: {
  bookingsCount: number;
  revenue: number;
  passedCount: number;
  onPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const progress = bookingsCount > 0 ? passedCount / bookingsCount : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        {
          borderColor: colors.border,
          borderRadius: radius.xl,
          opacity: pressed && onPress ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.statCardHeader, { marginBottom: spacing.md }]}>
        <Ionicons name="today-outline" size={18} color={colors.primary} />
        <Text variant="bodySmall" color="textSecondary" style={{ marginLeft: spacing.xs, fontWeight: '500' }}>Aujourd'hui</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md }}>
        <Text variant="h2" style={{ fontWeight: '800' }}>{bookingsCount} <Text variant="bodySmall" color="textMuted">RDV</Text></Text>
        <Text variant="h3" color="primary" style={{ fontWeight: '700' }}>{formatPrice(revenue)}</Text>
      </View>
      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full }]}>
        <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: colors.primary, borderRadius: radius.full }]} />
      </View>
      <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
        {passedCount}/{bookingsCount} passés
      </Text>
    </Pressable>
  );
}

/**
 * 7-day card — modernised. Replaces the chunky D/L/M/M/J/V/S bars
 * with a smoothed sparkline of CA over the last 7 days, the
 * period total, and a delta vs the previous 7 days.
 */
function StatCardWeek({
  revenue,
  delta,
  trend,
  bookingsCount,
  onPress,
}: {
  revenue: number;
  delta: number | null;
  trend: number[];
  bookingsCount: number;
  onPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        { borderColor: colors.border, borderRadius: radius.xl, opacity: pressed && onPress ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.statCardHeader, { marginBottom: spacing.md }]}>
        <Ionicons name="trending-up-outline" size={18} color={colors.info} />
        <Text variant="bodySmall" color="textSecondary" style={{ marginLeft: spacing.xs, fontWeight: '500', flex: 1 }}>
          7 derniers jours
        </Text>
        <DeltaChip delta={delta} />
      </View>
      <Text variant="h2" style={{ fontWeight: '800' }}>{formatPrice(revenue)}</Text>
      <Text variant="caption" color="textMuted" style={{ marginTop: 2, marginBottom: spacing.sm }}>
        {bookingsCount} RDV
      </Text>
      {/* Smoothed sparkline (height 32). Renders nothing if <2 data
          points — keeps the card visually tidy in that edge case. */}
      <View style={styles.sparklineSlot}>
        <Sparkline data={trend} width={STAT_CARD_WIDTH - 48} height={36} color={colors.info} />
      </View>
    </Pressable>
  );
}

/**
 * 30-day card — modernised. CA + delta vs 30j précédents + sparkline,
 * tappable to deep-link into /pro/stats.
 */
function StatCardMonth({
  revenue,
  delta,
  trend,
  completionRate,
  bookingsCount,
  onPress,
}: {
  revenue: number;
  delta: number | null;
  trend: number[];
  completionRate: number;
  bookingsCount: number;
  onPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const rateColor = completionRate >= 80 ? colors.success : completionRate >= 50 ? colors.warning : colors.error;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        { borderColor: colors.border, borderRadius: radius.xl, opacity: pressed && onPress ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.statCardHeader, { marginBottom: spacing.md }]}>
        <Ionicons name="wallet-outline" size={18} color={colors.success} />
        <Text variant="bodySmall" color="textSecondary" style={{ marginLeft: spacing.xs, fontWeight: '500', flex: 1 }}>
          30 derniers jours
        </Text>
        <DeltaChip delta={delta} />
      </View>
      <Text variant="h2" style={{ fontWeight: '800' }}>{formatPrice(revenue)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
        <Text variant="caption" color="textMuted">{bookingsCount} RDV</Text>
        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.4 }} />
        <Text variant="caption" style={{ color: rateColor, fontWeight: '600' }}>{completionRate}% réussite</Text>
      </View>
      <View style={[styles.sparklineSlot, { marginTop: spacing.sm }]}>
        <Sparkline data={trend} width={STAT_CARD_WIDTH - 48} height={36} color={colors.success} />
      </View>
      {/* No corner chevron: the card is already a Pressable and
          the DeltaChip lives in that exact spot. The previous
          version drew a small chevron at top:14/right:14 which
          rendered ON TOP of the "—" DeltaChip when the delta was
          null, producing a "chevron inside a grey circle" visual
          bug. The other carousel cards (Today, Week) don't carry
          a corner chevron either, so removing it also makes the
          three cards visually consistent. */}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Deposits card — visible only when the Sérénité add-on is active.
// Surfaces the 30-day "Acomptes encaissés" total + top services so
// the pro understands the value of what they pay 5 €/mois for, and
// can spot trends at a glance from the dashboard.
// ---------------------------------------------------------------------------
function DepositsCard({
  totalAmount,
  bookingsCount,
  topServices,
  loading,
  onPress,
}: {
  totalAmount: number;
  bookingsCount: number;
  topServices: { serviceId: string; serviceName: string; bookingsCount: number }[];
  loading: boolean;
  onPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          padding: spacing.lg,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed && onPress ? 0.92 : 1,
        },
      ]}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: colors.success + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" style={{ fontWeight: '700' }}>
            Acomptes encaissés
          </Text>
          <Text variant="caption" color="textMuted">
            30 derniers jours · Sérénité
          </Text>
        </View>
        {onPress && (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        )}
      </View>

      {/* Big amount + booking count */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs }}>
        <Text variant="h1" style={{ fontWeight: '800' }}>
          {formatPrice(totalAmount)}
        </Text>
        <Text variant="bodySmall" color="textMuted" style={{ marginBottom: 6 }}>
          sur {bookingsCount} RDV
        </Text>
      </View>

      {/* Top services */}
      {!loading && topServices.length > 0 && (
        <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text
            variant="caption"
            color="textMuted"
            style={{
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              fontWeight: '600',
              marginBottom: spacing.xs,
            }}
          >
            Prestations concernées
          </Text>
          {topServices.map((svc) => (
            <View
              key={svc.serviceId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 4,
              }}
            >
              <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>
                {svc.serviceName}
              </Text>
              <Text variant="caption" color="textMuted">
                {svc.bookingsCount} RDV
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty state — Sérénité active but no deposits collected yet */}
      {!loading && bookingsCount === 0 && (
        <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text variant="caption" color="textSecondary">
            Aucun acompte encaissé sur la période. Configurez un acompte
            par défaut ou par prestation pour commencer.
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// New-feature display labels
// ---------------------------------------------------------------------------
// User-facing names for each NewFeatureKey. Used by the discovery
// banner ("Découvrez Clients, Statistiques et Paiements"). Add the
// matching label here whenever a new key is shipped.
const FEATURE_DISPLAY_LABELS: Record<NewFeatureKey, string> = {
  'clients-2026-05': 'Clients',
  'stats-2026-05': 'Statistiques',
  'payments-2026-05': 'Paiements',
  // Story share lives on the home tab itself (FAB), not behind
  // Plus — the home banner never references it, but the map still
  // needs every key for type-completeness.
  'story-share-2026-05': 'Stories',
  'auto-review-2026-05': 'Avis auto',
};

/** "A, B et C" — French enumeration with proper "et" before the
 *  last item. Falls back to "A" / "A et B" for shorter lists. */
function joinFr(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} et ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProDashboardScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { provider, providerId, refreshProvider } = useProvider();

  // Welcome 🎉 overlay — shown once, right after a fresh registration.
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('opatam.justRegistered').then((v) => {
      if (active && v === '1') {
        setShowWelcome(true);
        AsyncStorage.removeItem('opatam.justRegistered').catch(() => {});
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const { user } = useAuth();
  const sub = useSubscriptionStatus();

  // In-app notification center — opened from the header avatar.
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const {
    notifications: appNotifications,
    unreadCount,
    markRead: markNotifRead,
    markAllRead: markAllNotifsRead,
  } = useProviderNotifications();

  const { data, isLoading, refresh } = useProviderDashboard(providerId, provider?.rating?.average);
  // Default 30-day window — gives us enough trend depth to derive
  // both the 7-day and 30-day cards from one fetch (sliced
  // last 7 / last 14..7 etc.).
  const { stats } = useProviderStats(providerId);
  const { reviews } = useReviews(providerId ?? undefined);

  // Deposits collected (last 30 days) — only meaningful when the
  // Sérénité add-on is active. The hook itself is harmless to call
  // either way (just returns zeros) but skipping the fetch entirely
  // when the addon is off saves a Firestore round-trip.
  const depositsAddonActive = !!provider?.depositsAddonActive;
  const depositsSummary = useDepositsSummary(
    depositsAddonActive ? providerId ?? undefined : undefined,
  );

  // Discovery banner — surfaces a prominent "Nouveautés" card on
  // the home tab while at least one feature behind /Plus hasn't
  // been opened yet. Tap navigates to the More tab; the dismiss
  // button marks every key seen so the banner disappears.
  const { isNew, hasAnyUnseen, markSeen } = useNewFeatures();
  const showDiscoveryBanner = hasAnyUnseen(MORE_TAB_FEATURE_KEYS);
  const unseenLabels = MORE_TAB_FEATURE_KEYS
    .filter((k) => isNew(k))
    .map((k) => FEATURE_DISPLAY_LABELS[k] ?? k);
  const dismissDiscoveryBanner = () => {
    MORE_TAB_FEATURE_KEYS.forEach((k) => markSeen(k));
  };

  // Derive 7-day vs previous-7-day metrics from the 30-day trend
  // window so the Week card has its own delta + sparkline without
  // a second hook call.
  const trend = stats?.trend ?? [];
  const weekRevenue = sumLast(trend, 7, 'revenue');
  const weekRevenuePrev = sumLast(trend, 7, 'revenue', 7);
  const weekBookings = sumLast(trend, 7, 'bookingsCount');
  const weekDelta = deltaPercent(weekRevenue, weekRevenuePrev);
  const weekTrendValues = trend.slice(-7).map((p) => p.revenue);
  const monthDelta = deltaPercent(stats?.revenue ?? 0, stats?.revenuePrevious ?? 0);
  const monthTrendValues = trend.map((p) => p.revenue);

  // Combined refresh: dashboard data + provider context
  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshProvider()]);
  }, [refresh, refreshProvider]);

  // Real-time page views
  const [pageViews, setPageViews] = useState<PageViewStats | null>(null);
  useEffect(() => {
    if (!providerId) return;
    const unsub = analyticsService.subscribeToPageViews(providerId, setPageViews);
    return unsub;
  }, [providerId]);

  const liveViews = pageViews ? analyticsService.computeLiveStats(pageViews) : null;

  // Carousel pagination
  const [activeStatCard, setActiveStatCard] = useState(0);
  const onStatScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (STAT_CARD_WIDTH + STAT_CARD_MARGIN));
    setActiveStatCard(Math.max(0, Math.min(2, idx)));
  }, []);

  // -- Booking actions -------------------------------------------------------

  const handleConfirm = useCallback(async (bookingId: string) => {
    if (!user) return;
    try {
      await bookingService.confirmBooking(bookingId, user.uid);
      await refresh();
    } catch {
      Alert.alert('Erreur', 'Impossible de confirmer le rendez-vous.');
    }
  }, [user, refresh]);

  const handleCancel = useCallback((bookingId: string) => {
    Alert.alert('Annuler le rendez-vous', 'Êtes-vous sûr de vouloir annuler ce rendez-vous ?', [
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
    ]);
  }, [user, refresh]);

  const navigateToBooking = useCallback((bookingId: string) => {
    router.push(`/(pro)/booking-detail/${bookingId}`);
  }, [router]);

  // -- Share establishment ---------------------------------------------------

  const [showQRModal, setShowQRModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [activeQRTab, setActiveQRTab] = useState<'booking' | 'paypal'>('booking');
  const shopUrl = provider?.slug ? `https://opatam.com/p/${provider.slug}` : null;
  const paypalLink = provider?.socialLinks?.paypal || null;
  const paypalUrl = paypalLink
    ? (paypalLink.startsWith('http') ? paypalLink : `https://paypal.me/${paypalLink}`)
    : null;

  const handleCopyLink = useCallback(async () => {
    if (!shopUrl) return;
    try {
      await Clipboard.setStringAsync(shopUrl);
      Alert.alert('Lien copié', 'Le lien a été copié dans le presse-papiers.');
    } catch {
      Alert.alert('Erreur', 'Impossible de copier le lien.');
    }
  }, [shopUrl]);


  const handleViewShop = useCallback(() => {
    if (!provider?.slug) return;
    router.push({ pathname: '/(client)/provider/[slug]', params: { slug: provider.slug, preview: '1' } });
  }, [provider?.slug, router]);

  const handleViewOnline = useCallback(() => {
    if (!shopUrl) return;
    Linking.openURL(shopUrl);
  }, [shopUrl]);

  const handleEditShop = useCallback(() => {
    router.push('/(pro)/profile');
  }, [router]);

  // -- Derived values (all hooks must be called before any early return) -----

  const today = new Date();
  const firstName = user?.displayName?.split(' ')[0] || provider?.businessName || 'Pro';
  const { todayBookings, pendingBookings, weekBookingsCount, weekBookingsPerDay, locations, services, members, averageRating } = data;
  const isTeamPlan = provider?.plan === 'team' || provider?.plan === 'trial';

  const todayRevenue = todayBookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const now = new Date();
  const passedTodayCount = todayBookings.filter((b) => toDate(b.datetime).getTime() < now.getTime()).length;

  // -- Team helpers -----------------------------------------------------------
  const getMemberBookings = useCallback((memberId: string) => {
    return todayBookings.filter((b) => b.memberId === memberId);
  }, [todayBookings]);

  const getLocationName = useCallback((locationId: string) => {
    return locations.find((l) => l.id === locationId)?.name || '';
  }, [locations]);

  // -- Setup alerts ----------------------------------------------------------
  const setupAlerts = useMemo(() => {
    if (!provider) return [];
    const alerts: { id: string; icon: keyof typeof Ionicons.glyphMap; message: string; route?: string; action?: string; color: string }[] = [];

    // 1. Pending bookings (urgent)
    if (pendingBookings.length > 0) {
      alerts.push({
        id: 'pending',
        icon: 'time-outline',
        message: `${pendingBookings.length} RDV en attente de confirmation`,
        route: '/(pro)/(tabs)/calendar',
        action: 'Voir',
        color: colors.warning,
      });
    }

    // 2. Page not published (critical)
    if (!provider.isPublished) {
      alerts.push({
        id: 'unpublished',
        icon: 'eye-off-outline',
        message: 'Votre page n\'est pas encore visible',
        route: '/(pro)/profile',
        action: 'Activer',
        color: colors.error,
      });
    }

    // 3. No services
    if (services.length === 0) {
      alerts.push({
        id: 'no-service',
        icon: 'pricetag-outline',
        message: 'Créez votre première prestation',
        route: '/(pro)/services',
        action: 'Créer',
        color: colors.warning,
      });
    }

    // 4. No locations
    if (locations.length === 0) {
      alerts.push({
        id: 'no-location',
        icon: 'location-outline',
        message: 'Ajoutez un lieu pour recevoir des réservations',
        route: '/(pro)/locations',
        action: 'Ajouter',
        color: colors.warning,
      });
    }

    // 5. No profile photo
    if (!provider.photoURL) {
      alerts.push({
        id: 'no-photo',
        icon: 'camera-outline',
        message: 'Ajoutez une photo de profil',
        route: '/(pro)/profile',
        action: 'Ajouter',
        color: colors.textMuted,
      });
    }

    // 6. No portfolio photos
    if (!provider.portfolioPhotos || provider.portfolioPhotos.length === 0) {
      alerts.push({
        id: 'no-portfolio',
        icon: 'images-outline',
        message: 'Ajoutez des photos à votre portfolio',
        route: '/(pro)/profile',
        action: 'Ajouter',
        color: colors.textMuted,
      });
    }

    return alerts;
  }, [provider, pendingBookings.length, locations.length, services.length, colors]);

  // -- Setup progress (completeness checklist) --------------------------------
  const setupSteps = useMemo(() => {
    if (!provider) return [];
    return [
      {
        id: 'photo',
        label: 'Photo de profil',
        icon: 'camera-outline' as keyof typeof Ionicons.glyphMap,
        done: !!provider.photoURL,
        route: '/(pro)/profile',
      },
      {
        id: 'description',
        label: 'Description',
        icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
        done: !!provider.description && provider.description.length > 10,
        route: '/(pro)/profile',
      },
      {
        id: 'services',
        label: 'Au moins 1 prestation',
        icon: 'pricetag-outline' as keyof typeof Ionicons.glyphMap,
        done: services.length > 0,
        route: '/(pro)/services',
      },
      {
        id: 'locations',
        label: 'Au moins 1 lieu',
        icon: 'location-outline' as keyof typeof Ionicons.glyphMap,
        done: locations.length > 0,
        route: '/(pro)/locations',
      },
      {
        id: 'portfolio',
        label: 'Photos portfolio',
        icon: 'images-outline' as keyof typeof Ionicons.glyphMap,
        done: !!provider.portfolioPhotos && provider.portfolioPhotos.length > 0,
        route: '/(pro)/profile',
      },
      {
        id: 'published',
        label: 'Page publiée',
        icon: 'globe-outline' as keyof typeof Ionicons.glyphMap,
        done: !!provider.isPublished,
        route: '/(pro)/profile',
      },
    ];
  }, [provider, services.length, locations.length]);

  const completedSteps = setupSteps.filter((s) => s.done).length;
  const totalSteps = setupSteps.length;
  const progressPct = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const isSetupComplete = completedSteps === totalSteps;
  const isPublished = !!provider?.isPublished;

  // Find the next upcoming booking (first one not yet passed)
  const sortedToday = [...todayBookings].sort((a, b) => toDate(a.datetime).getTime() - toDate(b.datetime).getTime());
  const nextBookingId = sortedToday.find((b) => toDate(b.datetime).getTime() > now.getTime())?.id ?? null;

  const displayedTodayBookings = sortedToday.slice(0, 5);
  const remainingTodayCount = todayBookings.length - 5;

  // Recent reviews (2 most recent)
  const recentReviews = useMemo(() => {
    if (!reviews?.length) return [];
    return [...reviews]
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
      .slice(0, 2);
  }, [reviews]);

  // -- Loading state ---------------------------------------------------------

  if (isLoading && todayBookings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={[styles.heroGradient, { paddingTop: insets.top + 16, paddingBottom: 24 }]} />
        <View style={styles.loaderContainer}><Loader /></View>
      </View>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Hero Gradient Banner ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={[styles.heroGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={[styles.heroContent, { paddingHorizontal: spacing.lg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text variant="h1" style={{ color: '#FFF', fontSize: 28 }} numberOfLines={1}>
                {provider?.businessName || firstName}
              </Text>
              <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                {formatFrenchDate(today)}
              </Text>
            </View>
            {/* Header avatar doubles as the notification-center entry:
                tap opens the drawer; a bell glyph signals it's clickable
                and a red badge shows the unread count. */}
            <Pressable
              onPress={() => setNotifDrawerOpen(true)}
              hitSlop={8}
              style={{ position: 'relative' }}
              accessibilityRole="button"
              accessibilityLabel="Nouveau"
            >
              <View style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderRadius: radius.full }}>
                <Avatar
                  imageUrl={provider?.photoURL || undefined}
                  name={provider?.businessName || firstName || 'O'}
                  size="lg"
                />
              </View>
              {/* Unread count (top-right) */}
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    paddingHorizontal: unreadCount > 9 ? 5 : 0,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFF',
                      fontSize: 11,
                      fontWeight: '800',
                      lineHeight: 14,
                      textAlign: 'center',
                      includeFontPadding: false,
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
              {/* No unread → a small bell affordance signals the avatar
                  is tappable to open the notification center. */}
              {unreadCount === 0 && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  }}
                >
                  <Ionicons name="notifications" size={12} color={colors.primary} />
                </View>
              )}
            </Pressable>
          </View>

          {/* Stat chips */}
          <View style={[styles.heroChips, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
            <HeroChip icon="calendar-outline" label={`${todayBookings.length} RDV`} />
            <HeroChip icon="wallet-outline" label={formatPrice(todayRevenue)} />
            {pendingBookings.length > 0 && (
              <HeroChip icon="time-outline" label={`${pendingBookings.length} en attente`} />
            )}
            {liveViews && liveViews.today > 0 && (
              <HeroChip icon="eye-outline" label={`${liveViews.today} vue${liveViews.today > 1 ? 's' : ''}`} />
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Subscription expired banner — premium incitation card ── */}
        {sub.needsSubscription && (
          <Pressable
            onPress={() => router.push('/(pro)/paywall')}
            style={({ pressed }) => ({ paddingHorizontal: spacing.lg, marginTop: spacing.md, opacity: pressed ? 0.92 : 1 })}
          >
            <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
              <LinearGradient
                colors={['#EF4444', '#E11D48']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: spacing.md }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontWeight: '800', color: '#FFFFFF' }}>
                      Votre essai est terminé
                    </Text>
                    <Text variant="caption" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                      Réactivez votre page pour continuer à recevoir des réservations.
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 11 }}>
                  <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 14 }}>Réactiver ma page</Text>
                  <Ionicons name="arrow-forward" size={16} color="#DC2626" />
                </View>
              </LinearGradient>
            </View>
          </Pressable>
        )}

        {/* ── Trial reminder banner (≤14 days) ── */}
        {!sub.needsSubscription && sub.daysRemaining != null && sub.daysRemaining <= 14 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <TrialReminderBanner daysRemaining={sub.daysRemaining} />
          </View>
        )}

        {/* ── Discovery banner — appears while any new feature
              behind the Plus tab is still unseen. Tap navigates
              to that tab; the X dismisses by marking every key
              as seen so the banner disappears. ── */}
        {showDiscoveryBanner && unseenLabels.length > 0 && (
          <Pressable
            onPress={() => router.push('/(pro)/(tabs)/more')}
            style={({ pressed }) => [
              {
                marginHorizontal: spacing.lg,
                marginTop: spacing.md,
                opacity: pressed ? 0.92 : 1,
                borderRadius: radius.lg,
                overflow: 'hidden',
              },
            ]}
          >
            <LinearGradient
              colors={['#1E40AF', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  variant="body"
                  style={{ color: '#FFFFFF', fontWeight: '700' }}
                >
                  Nouvelles fonctionnalités !
                </Text>
                <Text
                  variant="caption"
                  style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}
                  numberOfLines={1}
                >
                  Découvrez {joinFr(unseenLabels)} dans l'onglet Plus.
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  dismissDiscoveryBanner();
                }}
                hitSlop={10}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  padding: 4,
                })}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.85)" />
              </Pressable>
            </LinearGradient>
          </Pressable>
        )}


        {/* ── Setup Alerts ── */}
        {setupAlerts.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.xs }}>
            {setupAlerts.map((alert) => (
              <Pressable
                key={alert.id}
                onPress={alert.route ? () => router.push(alert.route as any) : undefined}
                disabled={!alert.route}
                style={({ pressed }) => [
                  styles.alertCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderLeftColor: alert.color,
                    opacity: pressed && alert.route ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name={alert.icon} size={18} color={alert.color} />
                <Text variant="bodySmall" style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>
                  {alert.message}
                </Text>
                {alert.route && alert.action && (
                  <View style={{ backgroundColor: alert.color + '18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text variant="caption" style={{ color: alert.color, fontWeight: '600', fontSize: 11 }}>{alert.action}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Setup Progress Card ── */}
        {!isSetupComplete && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <Card padding="lg" shadow="sm">
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={{ fontWeight: '700' }}>
                    {isPublished
                      ? 'Votre page est en ligne 🎉'
                      : `Votre page est prête à ${Math.round(progressPct * 100)} %`}
                  </Text>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    {isPublished
                      ? 'Quelques détails de plus pour tirer le meilleur de votre page.'
                      : 'Finalisez votre page pour recevoir vos premières réservations.'}
                  </Text>
                </View>
                <Text variant="h3" style={{ color: colors.primary, fontWeight: '800' }}>{Math.round(progressPct * 100)}%</Text>
              </View>

              {/* Progress bar */}
              <View style={{ height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 3, marginBottom: spacing.md, overflow: 'hidden' }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${progressPct * 100}%` }} />
              </View>

              {/* Checklist */}
              <View style={{ gap: spacing.sm }}>
                {setupSteps.map((step) => {
                  // Finale CTA — the "publish" step becomes a prominent button.
                  if (step.id === 'published' && !step.done) {
                    return (
                      <View
                        key={step.id}
                        style={{ marginTop: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}
                      >
                        <Pressable
                          onPress={() => router.push(step.route as any)}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: spacing.xs,
                            paddingVertical: spacing.md,
                            borderRadius: 12,
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
                          <Text variant="bodySmall" style={{ fontWeight: '700', color: '#FFFFFF' }}>
                            Publier ma page
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }
                  return (
                  <Pressable
                    key={step.id}
                    onPress={step.done ? undefined : () => router.push(step.route as any)}
                    disabled={step.done}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: step.done ? 0 : 1.5,
                      borderColor: colors.border,
                      backgroundColor: step.done ? colors.success : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {step.done && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Ionicons name={step.icon} size={16} color={step.done ? colors.textMuted : colors.text} />
                    <Text
                      variant="bodySmall"
                      style={{
                        flex: 1,
                        fontWeight: step.done ? '400' : '500',
                        textDecorationLine: step.done ? 'line-through' : 'none',
                        color: step.done ? colors.textMuted : colors.text,
                      }}
                    >
                      {step.label}
                    </Text>
                    {!step.done && (
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    )}
                  </Pressable>
                  );
                })}
              </View>
            </Card>
          </View>
        )}

        {/* ── Stat Cards Carousel ── */}
        <View style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
          <ScrollView
            horizontal
            snapToInterval={STAT_CARD_WIDTH + STAT_CARD_MARGIN}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            onMomentumScrollEnd={onStatScroll}
          >
            <View style={{ width: STAT_CARD_WIDTH, marginRight: STAT_CARD_MARGIN }}>
              <StatCardToday
                bookingsCount={todayBookings.length}
                revenue={todayRevenue}
                passedCount={passedTodayCount}
                // Tap → Planning tab. The "Aujourd'hui" card is a
                // summary of the day's bookings, so the natural drill-
                // down is the chronological list of today's events
                // (Planning defaults to "À venir" with today on top).
                onPress={() => router.push('/(pro)/(tabs)/bookings')}
              />
            </View>
            <View style={{ width: STAT_CARD_WIDTH, marginRight: STAT_CARD_MARGIN }}>
              <StatCardWeek
                revenue={weekRevenue}
                delta={weekDelta}
                trend={weekTrendValues}
                bookingsCount={weekBookings}
                onPress={() => router.push('/(pro)/stats')}
              />
            </View>
            <View style={{ width: STAT_CARD_WIDTH, marginRight: STAT_CARD_MARGIN }}>
              <StatCardMonth
                revenue={stats?.revenue ?? 0}
                delta={monthDelta}
                trend={monthTrendValues}
                completionRate={stats?.completionRate ?? 0}
                bookingsCount={stats?.bookingsCount ?? 0}
                onPress={() => router.push('/(pro)/stats')}
              />
            </View>
          </ScrollView>
          <PaginationDots count={3} active={activeStatCard} />
        </View>

        {/* ── Quick Actions ── */}
        {provider?.slug && (
          <View style={[styles.quickActions, { paddingHorizontal: spacing.lg, marginBottom: spacing.xl }]}>
            <QuickAction icon="qr-code-outline" label="QR Code" onPress={() => setShowQRModal(true)} />
            <QuickAction icon="storefront-outline" label="Aperçu" onPress={handleViewShop} />
            <QuickAction icon="globe-outline" label="En ligne" onPress={handleViewOnline} />
            <QuickAction icon="create-outline" label="Modifier" onPress={handleEditShop} />
          </View>
        )}

        {/* ── Acomptes encaissés (Sérénité add-on subscribers only) ── */}
        {depositsAddonActive && (
          <DepositsCard
            totalAmount={depositsSummary.totalAmount}
            bookingsCount={depositsSummary.bookingsCount}
            topServices={depositsSummary.topServices}
            loading={depositsSummary.loading}
            onPress={() => router.push('/(pro)/payments')}
          />
        )}

        {/* ── Team Section ── */}
        {isTeamPlan && members.length > 1 && (
          <View style={{ marginBottom: spacing.xl }}>
            <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text variant="h3">Mon équipe</Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.full, marginLeft: spacing.sm }]}>
                    <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>{members.length}</Text>
                  </View>
                </View>
                <Pressable onPress={() => router.push('/(pro)/members')} hitSlop={8}>
                  <Text variant="bodySmall" color="primary" style={{ fontWeight: '500' }}>Gérer →</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            >
              {members.map((member) => {
                const memberBookings = getMemberBookings(member.id);
                const locationName = getLocationName(member.locationId);
                const initials = member.name
                  .split(' ')
                  .map((w: string) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);
                const memberColor = member.color || colors.primary;

                return (
                  <Pressable
                    key={member.id}
                    onPress={() => router.push(`/(pro)/(tabs)/calendar?memberId=${member.id}` as any)}
                    style={({ pressed }) => [
                      styles.memberCard,
                      {
                        backgroundColor: colors.surface,
                        borderRadius: radius.xl,
                        borderColor: colors.border,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    {/* Subtle gradient background with member color */}
                    <LinearGradient
                      colors={[memberColor + '12', 'transparent']}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 80,
                        borderTopLeftRadius: radius.xl,
                        borderTopRightRadius: radius.xl,
                      }}
                    />

                    {/* Avatar */}
                    <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                      {member.photoURL ? (
                        <Image
                          source={{ uri: member.photoURL }}
                          style={[styles.memberAvatar, { borderColor: memberColor + '30' }]}
                        />
                      ) : (
                        <View style={[styles.memberAvatar, { backgroundColor: memberColor, borderColor: memberColor + '30' }]}>
                          <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                            {initials}
                          </Text>
                        </View>
                      )}
                      {/* Online indicator dot */}
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: memberColor,
                        position: 'absolute',
                        bottom: 0,
                        right: '50%',
                        marginRight: -22,
                        borderWidth: 2,
                        borderColor: colors.surface,
                      }} />
                    </View>

                    {/* Info */}
                    <Text variant="body" style={{ fontWeight: '700', textAlign: 'center', marginTop: spacing.sm, fontSize: 14 }} numberOfLines={1}>
                      {member.name}
                    </Text>
                    {locationName ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
                        <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                        <Text variant="caption" color="textMuted" style={{ marginLeft: 2, fontSize: 11 }} numberOfLines={1}>
                          {locationName}
                        </Text>
                      </View>
                    ) : null}

                    {/* Today's bookings stat */}
                    <View style={[styles.memberStat, { backgroundColor: memberColor + '15', borderRadius: radius.full, marginTop: spacing.sm }]}>
                      <Text variant="caption" style={{ color: memberColor, fontWeight: '700', fontSize: 13 }}>
                        {memberBookings.length}
                      </Text>
                      <Text variant="caption" style={{ color: memberColor, fontWeight: '500', marginLeft: 3, fontSize: 11 }}>
                        RDV
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Page Views ── */}
        {liveViews && (liveViews.total > 0 || liveViews.today > 0) && (
          <Pressable
            onPress={() => router.push('/(pro)/stats')}
            style={({ pressed }) => ({ paddingHorizontal: spacing.lg, marginBottom: spacing.xl, opacity: pressed ? 0.85 : 1 })}
          >
            <Text variant="h3" style={{ marginBottom: spacing.md }}>Vues de votre page</Text>
            <Card padding="lg" shadow="sm">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <LinearGradient
                  colors={[colors.primary, '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.viewsIconBadge, { borderRadius: radius.full }]}
                >
                  <Ionicons name="eye" size={22} color="#FFFFFF" />
                </LinearGradient>
                {/* Three equal columns — each number sits directly above its
                    own label, so the grouping is unambiguous. Today is
                    emphasised in the primary colour. */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text variant="h2" color="primary" style={{ fontWeight: '800' }}>{liveViews.today}</Text>
                    <Text variant="caption" color="textMuted" style={{ fontSize: 11, marginTop: 2, textAlign: 'center' }}>Aujourd'hui</Text>
                  </View>
                  <View style={[styles.viewsDivider, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text variant="h2" style={{ fontWeight: '800' }}>{liveViews.last7Days}</Text>
                    <Text variant="caption" color="textMuted" style={{ fontSize: 11, marginTop: 2, textAlign: 'center' }}>7 derniers jours</Text>
                  </View>
                  <View style={[styles.viewsDivider, { backgroundColor: colors.border }]} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text variant="h2" style={{ fontWeight: '800' }}>{liveViews.last30Days}</Text>
                    <Text variant="caption" color="textMuted" style={{ fontSize: 11, marginTop: 2, textAlign: 'center' }}>30 derniers jours</Text>
                  </View>
                </View>
              </View>

              {/* Incentive footer — tapping opens the story creation flow
                  (the most engaging way to drive new page views), without
                  navigating to the stats screen. */}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setShowStoryModal(true);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: spacing.md,
                  paddingTop: spacing.md,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="camera-outline" size={15} color={colors.primary} />
                <Text variant="caption" color="primary" style={{ fontWeight: '600', flex: 1 }}>
                  Créez une story pour attirer plus de clients
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            </Card>
          </Pressable>
        )}

        {/* ── Today's Bookings Timeline ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
            <View style={styles.sectionTitleRow}>
              <Text variant="h3">Aujourd'hui</Text>
              <View style={[styles.countBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.full, marginLeft: spacing.sm }]}>
                <Text variant="caption" color="primary" style={{ fontWeight: '700' }}>{todayBookings.length}</Text>
              </View>
            </View>
            {todayBookings.length > 0 && (
              <Pressable onPress={() => router.push('/(pro)/(tabs)/calendar')} hitSlop={8}>
                <Text variant="bodySmall" color="primary" style={{ fontWeight: '500' }}>Voir tout →</Text>
              </Pressable>
            )}
          </View>

          {todayBookings.length === 0 ? (
            <EmptyState
              icon="calendar-clear-outline"
              title="Aucun rendez-vous"
              description="Vous n'avez pas de rendez-vous aujourd'hui."
            />
          ) : (
            <>
              {displayedTodayBookings.map((booking) => {
                const bookingDate = toDate(booking.datetime);
                const isPast = bookingDate.getTime() < now.getTime();
                const isNext = booking.id === nextBookingId;
                const timeChip = isNext ? getTimeUntilChip(bookingDate) : null;

                return (
                  <TimelineBookingItem
                    key={booking.id}
                    time={formatTime(bookingDate)}
                    clientName={booking.clientInfo.name}
                    serviceName={booking.serviceName}
                    duration={booking.duration}
                    status={booking.status}
                    isPast={isPast}
                    timeChip={timeChip}
                    memberColor={booking.memberColor}
                    price={booking.price}
                    depositPaid={booking.deposit?.status === 'paid' ? booking.deposit.amount : null}
                    onPress={() => navigateToBooking(booking.id)}
                    onConfirm={booking.status === 'pending' ? () => handleConfirm(booking.id) : undefined}
                    onCancel={booking.status === 'pending' ? () => handleCancel(booking.id) : undefined}
                  />
                );
              })}
              {remainingTodayCount > 0 && (
                <Button
                  title={`Voir les ${remainingTodayCount} restants`}
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push('/(pro)/(tabs)/calendar')}
                  style={{ marginTop: spacing.xs, alignSelf: 'center' }}
                />
              )}
            </>
          )}
        </View>

        {/* ── Pending Bookings ── */}
        {pendingBookings.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
              <View style={styles.sectionTitleRow}>
                <Text variant="h3">À traiter</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.warningLight, borderRadius: radius.full, marginLeft: spacing.sm }]}>
                  <Text variant="caption" style={{ fontWeight: '700', color: colors.warningDark }}>{pendingBookings.length}</Text>
                </View>
              </View>
            </View>

            {pendingBookings.slice(0, 5).map((booking) => {
              const bookingDate = toDate(booking.datetime);
              return (
                <TimelineBookingItem
                  key={booking.id}
                  time={formatTime(bookingDate)}
                  clientName={booking.clientInfo.name}
                  serviceName={booking.serviceName}
                  duration={booking.duration}
                  status={booking.status}
                  isPast={false}
                  timeChip={null}
                  price={booking.price}
                  depositPaid={booking.deposit?.status === 'paid' ? booking.deposit.amount : null}
                  onPress={() => navigateToBooking(booking.id)}
                  onConfirm={() => handleConfirm(booking.id)}
                  onCancel={() => handleCancel(booking.id)}
                />
              );
            })}
          </View>
        )}

        {/* ── Recent Reviews ── */}
        {recentReviews.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
              <Text variant="h3">Derniers avis</Text>
              <Pressable onPress={() => router.push('/(pro)/reviews')} hitSlop={8}>
                <Text variant="bodySmall" color="primary" style={{ fontWeight: '500' }}>Voir tout →</Text>
              </Pressable>
            </View>

            {recentReviews.map((review) => (
              <Card key={review.id} padding="md" shadow="sm" style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                  <View style={{ flexDirection: 'row' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.rating ? 'star' : 'star-outline'}
                        size={14}
                        color={star <= review.rating ? '#FBBF24' : colors.border}
                      />
                    ))}
                  </View>
                  <Text variant="caption" color="textMuted">{review.clientName}</Text>
                </View>
                {review.comment && (
                  <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
                    "{review.comment}"
                  </Text>
                )}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Welcome 🎉 overlay (first launch after registration) ── */}
      <WelcomeOverlay
        visible={showWelcome}
        onDismiss={() => setShowWelcome(false)}
        businessName={provider?.businessName}
      />

      {/* ── Notification center (opened from the header avatar) ── */}
      <NotificationsDrawer
        visible={notifDrawerOpen}
        notifications={appNotifications}
        unreadCount={unreadCount}
        onClose={() => setNotifDrawerOpen(false)}
        onMarkRead={markNotifRead}
        onMarkAllRead={markAllNotifsRead}
      />

      {/* ── QR Code Modal ── */}
      {shopUrl && (
        <Modal visible={showQRModal} transparent animationType="fade" onRequestClose={() => setShowQRModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowQRModal(false)}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, margin: spacing.xl }]}
              onPress={() => {}}
            >
              {/* Tab bar */}
              <View style={[styles.qrTabBar, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg }]}>
                <Pressable
                  onPress={() => setActiveQRTab('booking')}
                  style={[
                    styles.qrTab,
                    {
                      borderRadius: radius.md,
                      backgroundColor: activeQRTab === 'booking' ? colors.surface : 'transparent',
                    },
                    activeQRTab === 'booking' && styles.qrTabActive,
                  ]}
                >
                  <Ionicons name="qr-code-outline" size={16} color={activeQRTab === 'booking' ? colors.primary : colors.textMuted} />
                  <Text
                    variant="bodySmall"
                    style={{ fontWeight: '600', marginLeft: 6, color: activeQRTab === 'booking' ? colors.primary : colors.textMuted }}
                  >
                    Réservation
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveQRTab('paypal')}
                  style={[
                    styles.qrTab,
                    {
                      borderRadius: radius.md,
                      backgroundColor: activeQRTab === 'paypal' ? colors.surface : 'transparent',
                    },
                    activeQRTab === 'paypal' && styles.qrTabActive,
                  ]}
                >
                  <Ionicons name="logo-paypal" size={16} color={activeQRTab === 'paypal' ? '#0070BA' : colors.textMuted} />
                  <Text
                    variant="bodySmall"
                    style={{ fontWeight: '600', marginLeft: 6, color: activeQRTab === 'paypal' ? '#0070BA' : colors.textMuted }}
                  >
                    PayPal
                  </Text>
                </Pressable>
              </View>

              {/* Tab content */}
              {activeQRTab === 'booking' ? (
                <>
                  <Text variant="body" color="textSecondary" align="center" style={{ marginBottom: spacing.lg, marginTop: spacing.md }}>
                    Partagez ce QR code pour que vos clients accèdent à votre page de réservation
                  </Text>
                  <View style={[styles.qrContainer, { backgroundColor: '#FFF', borderRadius: radius.lg, padding: spacing.md }]}>
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shopUrl)}&size=250x250&margin=10&ecc=H` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    {provider?.photoURL && (
                      <View style={styles.qrLogoWrapper}>
                        <Image
                          source={{ uri: provider.photoURL }}
                          style={styles.qrLogo}
                          resizeMode="cover"
                        />
                      </View>
                    )}
                  </View>
                  <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.md }}>{shopUrl}</Text>
                  <Pressable
                    onPress={() => { handleCopyLink(); setShowQRModal(false); }}
                    style={({ pressed }) => [
                      styles.modalButton,
                      { backgroundColor: pressed ? colors.primaryDark : colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, marginTop: spacing.lg, width: '100%' },
                    ]}
                  >
                    <Ionicons name="copy-outline" size={18} color="#FFF" style={{ marginRight: spacing.xs }} />
                    <Text variant="body" style={{ color: '#FFF', fontWeight: '600' }}>Copier le lien</Text>
                  </Pressable>
                </>
              ) : paypalUrl ? (
                <>
                  <Text variant="body" color="textSecondary" align="center" style={{ marginBottom: spacing.lg, marginTop: spacing.md }}>
                    Partagez ce QR code pour recevoir des paiements via PayPal
                  </Text>
                  <View style={[styles.qrContainer, { backgroundColor: '#FFF', borderRadius: radius.lg, padding: spacing.md }]}>
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(paypalUrl)}&size=250x250&margin=10&ecc=H` }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <View style={[styles.qrLogoWrapper, { backgroundColor: '#0070BA' }]}>
                      <Ionicons name="logo-paypal" size={28} color="#FFF" />
                    </View>
                  </View>
                  <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.md }}>{paypalUrl}</Text>
                  <Pressable
                    onPress={() => {
                      Clipboard.setStringAsync(paypalUrl);
                      Alert.alert('Lien copié', 'Le lien PayPal a été copié dans le presse-papiers.');
                      setShowQRModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalButton,
                      { backgroundColor: pressed ? '#005A9E' : '#0070BA', borderRadius: radius.lg, paddingVertical: spacing.md, marginTop: spacing.lg, width: '100%' },
                    ]}
                  >
                    <Ionicons name="copy-outline" size={18} color="#FFF" style={{ marginRight: spacing.xs }} />
                    <Text variant="body" style={{ color: '#FFF', fontWeight: '600' }}>Copier le lien PayPal</Text>
                  </Pressable>
                </>
              ) : (
                <View style={{ alignItems: 'center', marginTop: spacing.md, width: '100%' }}>
                  <View style={[styles.paypalEmptyIcon, { backgroundColor: '#E8F0FE', borderRadius: radius.full }]}>
                    <Ionicons name="logo-paypal" size={32} color="#0070BA" />
                  </View>
                  <Text variant="h3" align="center" style={{ marginTop: spacing.lg }}>
                    PayPal non configuré
                  </Text>
                  <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, paddingHorizontal: spacing.sm }}>
                    Ajoutez votre lien PayPal depuis l'interface web pour générer un QR code de paiement.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setShowQRModal(false);
                      Linking.openURL('https://opatam.com/pro/profil?tab=reseaux');
                    }}
                    style={({ pressed }) => [
                      styles.modalButton,
                      { backgroundColor: pressed ? '#005A9E' : '#0070BA', borderRadius: radius.lg, paddingVertical: spacing.md, marginTop: spacing.lg, width: '100%' },
                    ]}
                  >
                    <Ionicons name="open-outline" size={18} color="#FFF" style={{ marginRight: spacing.xs }} />
                    <Text variant="body" style={{ color: '#FFF', fontWeight: '600' }}>Configurer PayPal</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Share FAB — lazy loaded with error boundary for native module safety */}
      {shopUrl && (
        <NativeModuleBoundary resetKey={shopUrl}>
          <Suspense fallback={null}>
            <LazyShareFAB
              shopUrl={shopUrl}
              businessName={provider?.businessName || ''}
              onCreateStory={() => setShowStoryModal(true)}
            />
          </Suspense>
        </NativeModuleBoundary>
      )}

      {/* Story Share Modal — lazy loaded with error boundary */}
      <NativeModuleBoundary resetKey={showStoryModal}>
        <Suspense fallback={null}>
          <LazyStoryShareModal
            visible={showStoryModal}
            onClose={() => setShowStoryModal(false)}
          />
        </Suspense>
      </NativeModuleBoundary>
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
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },

  // Hero
  heroGradient: {
    paddingBottom: 20,
  },
  heroContent: {},
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroChipText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    fontSize: 12,
  },

  // Stat cards
  statCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    padding: 16,
    height: 170,
    justifyContent: 'space-between' as const,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  completionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },

  // Sparkline slot — fixed-height container so the card height
  // stays consistent whether or not data is present.
  sparklineSlot: {
    height: 36,
    justifyContent: 'flex-end',
  },
  // +/- delta pill displayed in the top-right of the modernised
  // stat cards.
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },

  // Pagination dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Page views
  viewsIconBadge: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  viewsDivider: {
    width: 1,
    height: 28,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: 60,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Timeline booking items
  timelineItem: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  timelineBar: {
    width: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timelineActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // QR Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrLogoWrapper: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    // Shadow for contrast
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  qrLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // QR Tabs
  qrTabBar: {
    flexDirection: 'row',
    padding: 3,
    marginBottom: 4,
    width: '100%',
  },
  qrTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  qrTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  paypalEmptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Team member cards
  memberCard: {
    width: 130,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 14,
    alignItems: 'center' as const,
    overflow: 'hidden' as const,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  memberStat: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
