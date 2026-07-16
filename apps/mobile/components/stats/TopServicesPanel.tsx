import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../../components';
import { useTheme } from '../../theme';
import {
  formatPrice,
  type ProviderStatsServiceBreakdown,
} from '@booking-app/shared';

/**
 * Top-services list — mirrors the web TopServicesPanel: rank +
 * name on the left, RDV count and revenue on the right, a thin
 * primary-coloured progress bar under each row scaled against the
 * top performer to show relative weight.
 */
export function TopServicesPanel({
  data,
}: {
  data: ProviderStatsServiceBreakdown[];
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const max = Math.max(...data.map((s) => s.revenue), 1);
  return (
    <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
      <View style={{ marginBottom: spacing.md }}>
        <Text variant="h3">{t('proStats.topServices.title')}</Text>
        <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
          {t('proStats.topServices.subtitle')}
        </Text>
      </View>
      {data.length === 0 ? (
        <Text variant="caption" color="textMuted">
          {t('proStats.topServices.empty')}
        </Text>
      ) : (
        data.slice(0, 5).map((s, i) => (
          <View key={s.serviceId} style={{ marginBottom: spacing.sm }}>
            <View style={[s2.row, { gap: spacing.sm }]}>
              <Text
                variant="caption"
                color="textMuted"
                style={{ width: 14, fontVariant: ['tabular-nums'] }}
              >
                {i + 1}
              </Text>
              <Text variant="body" style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>
                {s.serviceName}
              </Text>
              <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>
                {t('proStats.bookingsCount', { count: s.confirmedCount })}
              </Text>
              <Text variant="body" style={{ fontWeight: '700', minWidth: 64, textAlign: 'right' }}>
                {formatPrice(s.revenue)}
              </Text>
            </View>
            <View
              style={[
                s2.barTrack,
                { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full },
              ]}
            >
              <View
                style={{
                  width: `${(s.revenue / max) * 100}%`,
                  height: '100%',
                  backgroundColor: colors.primary,
                  borderRadius: radius.full,
                }}
              />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const s2 = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barTrack: {
    height: 4,
    marginTop: 6,
    marginLeft: 22, // align after rank column
    overflow: 'hidden',
  },
});
