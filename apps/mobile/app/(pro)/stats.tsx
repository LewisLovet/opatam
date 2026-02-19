/**
 * Statistics Screen — Premium redesign
 * Gradient hero with revenue highlight, visual stat breakdowns,
 * weekly bar chart, and rating section.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Loader, Text } from '../../components';
import { useProvider } from '../../contexts';
import { useProviderDashboard, useProviderStats } from '../../hooks';
import { useTheme } from '../../theme';
import { analyticsService } from '@booking-app/firebase';
import type { PageViewStats } from '@booking-app/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function formatPrice(centimes: number): string {
  const euros = centimes / 100;
  return euros % 1 === 0 ? `${euros} €` : `${euros.toFixed(2)} €`;
}

function getCurrentMonthLabel(): string {
  const now = new Date();
  return `${FRENCH_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

/** Stat row item for the breakdown section */
function StatRow({
  icon,
  iconColor,
  label,
  value,
  barRatio,
  barColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  barRatio: number;
  barColor: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={[s.statRow, { marginBottom: spacing.md }]}>
      <View style={[s.statRowLeft, { gap: spacing.sm }]}>
        <View style={[s.statRowIcon, { backgroundColor: iconColor + '18', borderRadius: radius.full }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text variant="body" style={{ fontWeight: '500', flex: 1 }}>{label}</Text>
        <Text variant="body" style={{ fontWeight: '700' }}>{value}</Text>
      </View>
      <View style={[s.barTrack, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full, marginTop: spacing.xs }]}>
        <View style={[s.barFill, { width: `${Math.min(barRatio * 100, 100)}%`, backgroundColor: barColor, borderRadius: radius.full }]} />
      </View>
    </View>
  );
}

/** Weekly mini bar chart (reused concept from dashboard) */
function WeekChart({ perDay }: { perDay: number[] }) {
  const { colors, spacing, radius } = useTheme();
  const maxPerDay = Math.max(...perDay, 1);
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();

  return (
    <View style={s.weekChart}>
      {perDay.map((count, i) => (
        <View key={i} style={s.weekChartCol}>
          <View style={[s.weekChartBarBg, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm }]}>
            <View
              style={[
                s.weekChartBarFill,
                {
                  height: `${(count / maxPerDay) * 100}%`,
                  backgroundColor: i === todayIdx ? colors.primary : colors.border,
                  borderRadius: radius.sm,
                },
              ]}
            />
          </View>
          <Text
            variant="caption"
            style={{
              fontSize: 11,
              color: i === todayIdx ? colors.primary : colors.textMuted,
              fontWeight: i === todayIdx ? '700' : '400',
              marginTop: 4,
            }}
          >
            {DAY_LABELS[i]}
          </Text>
          <Text variant="caption" style={{ fontSize: 10, color: colors.textMuted }}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function StatsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { providerId, provider } = useProvider();
  const { stats, isLoading, refresh } = useProviderStats(providerId);
  const { data: dashData } = useProviderDashboard(providerId, provider?.rating?.average);

  const total = stats?.total ?? 0;

  // Real-time page views
  const [pageViews, setPageViews] = useState<PageViewStats | null>(null);
  useEffect(() => {
    if (!providerId) return;
    const unsub = analyticsService.subscribeToPageViews(providerId, setPageViews);
    return unsub;
  }, [providerId]);

  const liveViews = pageViews ? analyticsService.computeLiveStats(pageViews) : null;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* ── Hero Gradient ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={[s.hero, { paddingTop: insets.top + 8 }]}
      >
        {/* Back button + title */}
        <View style={[s.heroHeader, { paddingHorizontal: spacing.lg }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[s.backBtn, { borderRadius: radius.full }]}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <Text variant="h2" style={{ color: '#FFF', marginLeft: spacing.md }}>Statistiques</Text>
        </View>

        {/* Revenue highlight */}
        <View style={[s.heroRevenue, { paddingHorizontal: spacing.lg, marginTop: spacing.lg }]}>
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>
            Revenus — {getCurrentMonthLabel()}
          </Text>
          {isLoading ? (
            <View style={{ height: 44, justifyContent: 'center' }}><Loader size="sm" /></View>
          ) : (
            <>
              <Text variant="h1" style={{ color: '#FFF', fontSize: 36, fontWeight: '800', marginTop: 4 }}>
                {formatPrice(stats?.monthlyRevenue ?? 0)}
              </Text>
              <View style={[s.heroChips, { marginTop: spacing.sm }]}>
                <View style={s.heroChip}>
                  <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.9)" />
                  <Text variant="caption" style={s.heroChipText}>
                    {stats?.monthlyBookingsCount ?? 0} RDV ce mois
                  </Text>
                </View>
                <View style={s.heroChip}>
                  <Ionicons name="trending-up-outline" size={13} color="rgba(255,255,255,0.9)" />
                  <Text variant="caption" style={s.heroChipText}>
                    {stats?.completionRate ?? 0}% réussite
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </LinearGradient>

      {/* ── Scrollable content ── */}
      {isLoading && !stats ? (
        <View style={s.center}><Loader /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />}
        >
          {/* ── Booking Breakdown ── */}
          <Text variant="h3" style={{ marginBottom: spacing.md }}>Répartition des RDV</Text>
          <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
            <StatRow
              icon="checkmark-circle-outline"
              iconColor={colors.success}
              label="Confirmés"
              value={stats?.confirmed ?? 0}
              barRatio={total > 0 ? (stats?.confirmed ?? 0) / total : 0}
              barColor={colors.success}
            />
            <StatRow
              icon="close-circle-outline"
              iconColor={colors.error}
              label="Annulés"
              value={stats?.cancelled ?? 0}
              barRatio={total > 0 ? (stats?.cancelled ?? 0) / total : 0}
              barColor={colors.error}
            />
            <StatRow
              icon="alert-circle-outline"
              iconColor={colors.textMuted}
              label="Absents"
              value={stats?.noshow ?? 0}
              barRatio={total > 0 ? (stats?.noshow ?? 0) / total : 0}
              barColor={colors.textMuted}
            />
            {/* Total footer */}
            <View style={[s.totalRow, { borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm }]}>
              <Text variant="body" style={{ fontWeight: '600' }}>Total</Text>
              <Text variant="h3" style={{ fontWeight: '800' }}>{total}</Text>
            </View>
          </Card>

          {/* ── This Week ── */}
          <Text variant="h3" style={{ marginBottom: spacing.md }}>Cette semaine</Text>
          <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md }}>
              <Text variant="h2" style={{ fontWeight: '800' }}>{dashData.weekBookingsCount}</Text>
              <Text variant="caption" color="textMuted">RDV cette semaine</Text>
            </View>
            <WeekChart perDay={dashData.weekBookingsPerDay} />
          </Card>

          {/* ── Page Views ── */}
          {liveViews && (
            <>
              <Text variant="h3" style={{ marginBottom: spacing.md }}>Visibilité</Text>
              <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
                {/* Big today number + subtitle */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                  <View style={[s.viewsBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.full }]}>
                    <Ionicons name="eye-outline" size={26} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                      <Text variant="h1" style={{ fontWeight: '800' }}>{liveViews.today}</Text>
                      <Text variant="bodySmall" color="textMuted">vue{liveViews.today !== 1 ? 's' : ''} aujourd'hui</Text>
                    </View>
                  </View>
                </View>
                {/* Stat pills row */}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={[s.viewsPill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, flex: 1 }]}>
                    <Text variant="h3" style={{ fontWeight: '800' }}>{liveViews.last7Days}</Text>
                    <Text variant="caption" color="textMuted">7 derniers jours</Text>
                  </View>
                  <View style={[s.viewsPill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, flex: 1 }]}>
                    <Text variant="h3" style={{ fontWeight: '800' }}>{liveViews.last30Days}</Text>
                    <Text variant="caption" color="textMuted">30 derniers jours</Text>
                  </View>
                  <View style={[s.viewsPill, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, flex: 1 }]}>
                    <Text variant="h3" style={{ fontWeight: '800' }}>{liveViews.total}</Text>
                    <Text variant="caption" color="textMuted">Total</Text>
                  </View>
                </View>
              </Card>
            </>
          )}

          {/* ── Completion Rate ── */}
          <Text variant="h3" style={{ marginBottom: spacing.md }}>Performance</Text>
          <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              {/* Rate ring placeholder — large number with colored bg */}
              <View style={[s.rateBadge, {
                backgroundColor: ((stats?.completionRate ?? 0) >= 80 ? colors.success : (stats?.completionRate ?? 0) >= 50 ? colors.warning : colors.error) + '18',
                borderRadius: radius.full,
              }]}>
                <Text variant="h1" style={{
                  fontWeight: '800',
                  color: (stats?.completionRate ?? 0) >= 80 ? colors.success : (stats?.completionRate ?? 0) >= 50 ? colors.warning : colors.error,
                }}>
                  {stats?.completionRate ?? 0}%
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600' }}>Taux de réussite</Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                  RDV honorés sur l'ensemble des réservations
                </Text>
              </View>
            </View>
          </Card>

          {/* ── Rating ── */}
          {provider?.rating && provider.rating.count > 0 && (
            <>
              <Text variant="h3" style={{ marginBottom: spacing.md }}>Avis clients</Text>
              <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={[s.ratingBadge, { backgroundColor: '#FBBF24' + '18', borderRadius: radius.full }]}>
                    <Ionicons name="star" size={28} color="#FBBF24" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                      <Text variant="h1" style={{ fontWeight: '800' }}>{provider.rating.average.toFixed(1)}</Text>
                      <Text variant="bodySmall" color="textMuted">/ 5</Text>
                    </View>
                    <Text variant="caption" color="textMuted">
                      {provider.rating.count} avis client{provider.rating.count > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {/* Star breakdown visual */}
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= Math.round(provider.rating!.average) ? 'star' : 'star-outline'}
                        size={16}
                        color="#FBBF24"
                      />
                    ))}
                  </View>
                </View>
              </Card>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  hero: {
    paddingBottom: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroRevenue: {},
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

  // Stat row
  statRow: {},
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRowIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTrack: {
    height: 5,
    width: '100%',
    marginLeft: 44, // Align with text after icon
  },
  barFill: {
    height: '100%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
  },

  // Week chart
  weekChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
    gap: 8,
  },
  weekChartCol: {
    flex: 1,
    alignItems: 'center',
  },
  weekChartBarBg: {
    width: '100%',
    height: 56,
    justifyContent: 'flex-end',
  },
  weekChartBarFill: {
    width: '100%',
    minHeight: 3,
  },

  // Views
  viewsBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewsPill: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },

  // Rate badge
  rateBadge: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rating badge
  ratingBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
