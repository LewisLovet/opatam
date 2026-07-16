/**
 * OtherRevenuePanel — paid-activity revenue track, surfaced
 * alongside the booking KPIs on /pro/stats.
 *
 * Activities (BlockedSlot with category + amount) accumulate
 * separately from booking revenue so the pro can see at a
 * glance what comes from the platform vs. what they earn in
 * parallel (workshops, off-platform consultations, etc.).
 *
 * Renders nothing when there's no activity revenue on the
 * period — providers who don't use the feature never see this
 * panel. Mirrors the web OtherRevenuePanel visually so the two
 * surfaces stay coherent.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../../components';
import { useTheme } from '../../theme';
import {
  formatPrice,
  type ActivityCategory,
  type ProviderStatsActivityBreakdown,
} from '@booking-app/shared';
import {
  ACTIVITY_CATEGORY_META,
} from '../business/Activity/categoryMeta';

interface Props {
  data: ProviderStatsActivityBreakdown[];
  /** Total — passed in (already summed by the hook) so the figure
   *  matches whatever the parent might show in a header. */
  total: number;
  count: number;
  /**
   * Human-readable label of the period the parent filter is set
   * to (e.g. "30 jours"). Surfaced in the subtitle since this
   * panel has no chart to visually anchor the time window.
   */
  periodLabel: string;
}

export function OtherRevenuePanel({ data, total, count, periodLabel }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  if (total === 0 || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
      {/* Header row — title + total. The total is duplicated next
          to the per-category breakdown for quick scanning at the
          card level without the user having to sum the bars. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="h3">{t('proStats.otherRevenue.title')}</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {t('proStats.otherRevenue.subtitle', { period: periodLabel })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="h3" style={{ fontWeight: '800' }}>
            {formatPrice(total)}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('proStats.otherRevenue.activitiesCount', { count })}
          </Text>
        </View>
      </View>

      {data.map((c) => {
        const meta = ACTIVITY_CATEGORY_META[c.category as ActivityCategory];
        return (
          <View key={c.category} style={{ marginBottom: spacing.sm }}>
            <View style={[styles.row, { gap: spacing.sm }]}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: meta?.color ?? colors.textMuted,
                }}
              />
              <Text
                variant="body"
                style={{ flex: 1, fontWeight: '500' }}
                numberOfLines={1}
              >
                {t(`proStats.activityCategories.${c.category}`, {
                  defaultValue: meta?.label ?? c.category,
                })}
              </Text>
              <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>
                {c.count}
              </Text>
              <Text
                variant="body"
                style={{ fontWeight: '700', minWidth: 64, textAlign: 'right' }}
              >
                {formatPrice(c.revenue)}
              </Text>
            </View>
            <View
              style={[
                styles.barTrack,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                },
              ]}
            >
              <View
                style={{
                  width: `${(c.revenue / max) * 100}%`,
                  height: '100%',
                  backgroundColor: meta?.color ?? colors.textMuted,
                  borderRadius: radius.full,
                }}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barTrack: {
    height: 4,
    marginTop: 6,
    marginLeft: 16, // align after the colour-dot column
    overflow: 'hidden',
  },
});
