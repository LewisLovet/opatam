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
import { TrendChart } from '../../components/stats/TrendChart';
import { TopServicesPanel } from '../../components/stats/TopServicesPanel';
import { TopClientsPanel } from '../../components/stats/TopClientsPanel';
import { QualityIndicators } from '../../components/stats/QualityIndicators';
import { HeatmapPanel } from '../../components/stats/HeatmapPanel';
import { useProvider } from '../../contexts';
import { useProviderDashboard, useProviderStats } from '../../hooks';
import { useTheme } from '../../theme';
import { analyticsService } from '@booking-app/firebase';
import {
  deltaPercent,
  PERIOD_LABELS,
  type PageViewStats,
  type Period,
} from '@booking-app/shared';

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

/** Horizontal pills to switch the active period. */
function PeriodPills({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { colors, radius } = useTheme();
  const order: Period[] = ['7d', '30d', '90d', '12m'];
  return (
    <View style={[s.periodPills, { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.full }]}>
      {order.map((p) => {
        const active = value === p;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            style={[
              s.periodPill,
              {
                backgroundColor: active ? '#FFF' : 'transparent',
                borderRadius: radius.full,
              },
            ]}
            hitSlop={4}
          >
            <Text
              variant="caption"
              style={{
                color: active ? colors.primaryDark : 'rgba(255,255,255,0.85)',
                fontWeight: active ? '700' : '500',
                fontSize: 12,
              }}
            >
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact KPI card with delta arrow. */
function KpiCard({
  icon,
  iconColor,
  label,
  value,
  current,
  previous,
  formatValue,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  current: number;
  previous: number;
  formatValue?: (v: number) => string;
}) {
  const { colors, spacing, radius } = useTheme();
  const delta = deltaPercent(current, previous);
  const positive = delta !== null && delta > 0;
  const negative = delta !== null && delta < 0;
  return (
    <View style={[s.kpiCard, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <View style={[s.kpiIcon, { backgroundColor: iconColor + '18', borderRadius: radius.full }]}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
        <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>{label}</Text>
      </View>
      <Text variant="h3" style={{ fontWeight: '800', marginBottom: 2 }}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {delta === null ? (
          <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>—</Text>
        ) : (
          <>
            <Ionicons
              name={positive ? 'arrow-up' : negative ? 'arrow-down' : 'remove'}
              size={11}
              color={positive ? colors.success : negative ? colors.error : colors.textMuted}
            />
            <Text
              variant="caption"
              style={{
                color: positive ? colors.success : negative ? colors.error : colors.textMuted,
                fontWeight: '600',
                fontSize: 11,
              }}
            >
              {delta > 0 ? '+' : ''}{delta}%
            </Text>
          </>
        )}
      </View>
      {/* Suppress unused-arg warning when formatValue not used */}
      {formatValue ? null : null}
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

  const [period, setPeriod] = useState<Period>('30d');
  const { stats, isLoading, refresh } = useProviderStats(providerId, period);
  const { data: dashData } = useProviderDashboard(providerId, provider?.rating?.average);

  const total = stats?.bookingsCount ?? 0;
  const revenueDelta = stats ? deltaPercent(stats.revenue, stats.revenuePrevious) : null;

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
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Revenus — {PERIOD_LABELS[period].toLowerCase()}
          </Text>
          {isLoading ? (
            <View style={{ height: 44, justifyContent: 'center' }}><Loader size="sm" /></View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 4 }}>
                <Text variant="h1" style={{ color: '#FFF', fontSize: 36, fontWeight: '800' }}>
                  {formatPrice(stats?.revenue ?? 0)}
                </Text>
                {revenueDelta !== null && (
                  <View style={[
                    s.heroDelta,
                    {
                      backgroundColor:
                        revenueDelta > 0
                          ? 'rgba(34, 197, 94, 0.25)'
                          : revenueDelta < 0
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(255,255,255,0.15)',
                    },
                  ]}>
                    <Ionicons
                      name={revenueDelta > 0 ? 'arrow-up' : revenueDelta < 0 ? 'arrow-down' : 'remove'}
                      size={11}
                      color="#FFF"
                    />
                    <Text variant="caption" style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>
                      {revenueDelta > 0 ? '+' : ''}{revenueDelta}%
                    </Text>
                  </View>
                )}
              </View>
              <View style={[s.heroChips, { marginTop: spacing.sm }]}>
                <View style={s.heroChip}>
                  <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.9)" />
                  <Text variant="caption" style={s.heroChipText}>
                    {stats?.bookingsCount ?? 0} RDV
                  </Text>
                </View>
                <View style={s.heroChip}>
                  <Ionicons name="trending-up-outline" size={13} color="rgba(255,255,255,0.9)" />
                  <Text variant="caption" style={s.heroChipText}>
                    {stats?.completionRate ?? 0}% réussite
                  </Text>
                </View>
              </View>
              {/* Period selector */}
              <View style={{ marginTop: spacing.lg }}>
                <PeriodPills value={period} onChange={setPeriod} />
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
          {/* ── KPI grid: 3 cards with deltas ── */}
          <View style={[s.kpiGrid, { marginBottom: spacing.xl, gap: spacing.sm }]}>
            <KpiCard
              icon="calendar-outline"
              iconColor={colors.primary}
              label="Réservations"
              value={(stats?.bookingsCount ?? 0).toString()}
              current={stats?.bookingsCount ?? 0}
              previous={stats?.bookingsCountPrevious ?? 0}
            />
            <KpiCard
              icon="people-outline"
              iconColor="#10B981"
              label="Clients"
              value={(stats?.uniqueClients ?? 0).toString()}
              current={stats?.uniqueClients ?? 0}
              previous={stats?.uniqueClientsPrevious ?? 0}
            />
            <KpiCard
              icon="eye-outline"
              iconColor="#8B5CF6"
              label="Vues"
              value={(stats?.pageViews ?? 0).toLocaleString('fr-FR')}
              current={stats?.pageViews ?? 0}
              previous={stats?.pageViewsPrevious ?? 0}
            />
          </View>

          {/* ── Trend charts (revenue + page views) ── */}
          {stats && stats.trend.length > 0 && (
            <>
              <TrendChart
                data={stats.trend}
                title="Évolution du chiffre d'affaires"
                valueKey="revenue"
                chartType={stats.chartType}
                formatYAxis={(v) =>
                  v >= 100_000
                    ? `${Math.round(v / 100_000)}k€`
                    : `${(v / 100).toFixed(0)}€`
                }
                // Precise value when the user taps a bar / point —
                // avoids the abbreviated "1k€" you get on the
                // Y-axis. Uses the same helper as the hero KPI.
                formatTooltipValue={formatPrice}
              />
              <TrendChart
                data={stats.trend}
                title="Vues de la vitrine"
                valueKey="pageViews"
                chartType={stats.chartType}
                formatYAxis={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                }
                formatTooltipValue={(v) =>
                  `${v.toLocaleString('fr-FR')} vue${v !== 1 ? 's' : ''}`
                }
              />
            </>
          )}

          {/* ── Top services + top clients ── */}
          {stats && (stats.topServices.length > 0 || stats.topClients.length > 0) && (
            <>
              <TopServicesPanel data={stats.topServices} />
              <TopClientsPanel data={stats.topClients} />
            </>
          )}

          {/* ── Booking Breakdown ── */}
          <Text variant="h3" style={{ marginBottom: spacing.md }}>Répartition des RDV</Text>
          <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
            <StatRow
              icon="checkmark-circle-outline"
              iconColor={colors.success}
              label="Confirmés"
              value={stats?.confirmedCount ?? 0}
              barRatio={total > 0 ? (stats?.confirmedCount ?? 0) / total : 0}
              barColor={colors.success}
            />
            <StatRow
              icon="close-circle-outline"
              iconColor={colors.error}
              label="Annulés"
              value={stats?.cancelledCount ?? 0}
              barRatio={total > 0 ? (stats?.cancelledCount ?? 0) / total : 0}
              barColor={colors.error}
            />
            <StatRow
              icon="alert-circle-outline"
              iconColor={colors.textMuted}
              label="Absents"
              value={stats?.noshowCount ?? 0}
              barRatio={total > 0 ? (stats?.noshowCount ?? 0) / total : 0}
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

          {/* ── Quality indicators (annulation / no-show / note) ── */}
          {stats && (
            <QualityIndicators
              cancellationRate={stats.cancellationRate}
              noshowRate={stats.noshowRate}
              averageRating={provider?.rating?.average ?? null}
              ratingCount={provider?.rating?.count ?? 0}
            />
          )}

          {/* ── Heatmap day×hour, period-independent (always 90d) ── */}
          {stats?.heatmap90d && stats.heatmap90d.length === 168 && (
            <HeatmapPanel heatmap={stats.heatmap90d} />
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
  heroDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },

  // Period pills
  periodPills: {
    flexDirection: 'row',
    padding: 3,
    alignSelf: 'flex-start',
  },
  periodPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginHorizontal: 1,
  },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  kpiIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stat row
  statRow: {
    overflow: 'hidden',
  },
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

});
