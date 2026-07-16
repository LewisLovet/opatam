import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from '../../components';
import { useTheme } from '../../theme';

/**
 * Day-of-week × hour-of-day heatmap over the 90-day rolling
 * window. The data is a flat 168-element array indexed as
 * [dow * 24 + hour] (dow 0 = Sunday … 6 = Saturday).
 *
 * Mobile rendering: 7 rows × 24 cells. The row is wide on phones
 * so we wrap the table in a horizontal ScrollView — let the user
 * scrub along the X axis rather than squeezing every hour into
 * the screen width.
 */
export function HeatmapPanel({ heatmap }: { heatmap: number[] }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const max = Math.max(...heatmap, 1);
  const total = heatmap.reduce((s, v) => s + v, 0);
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

  // Localised short weekday labels, indexed by JS getDay() (0 = Sunday).
  // 2021-08-01 (UTC) was a Sunday — format 7 consecutive days from there.
  const dayLabels = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return Array.from({ length: 7 }, (_, dow) => {
      const raw = fmt.format(new Date(Date.UTC(2021, 7, 1 + dow)));
      const clean = raw.replace(/\.$/, '');
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    });
  }, [i18n.language]);

  return (
    <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{t('proStats.heatmap.title')}</Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {t('proStats.heatmap.subtitle')}
          </Text>
        </View>
        <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>
          {t('proStats.bookingsCount', { count: total })}
        </Text>
      </View>
      {total === 0 ? (
        <Text variant="caption" color="textMuted">
          {t('proStats.heatmap.empty')}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 6 }}
        >
          <View>
            {/* Hour labels — every 3h to avoid crowding on a phone. */}
            <View style={[s.row, { marginLeft: 28 }]}>
              {Array.from({ length: 24 }, (_, h) => (
                <View key={h} style={[s.cellSlot, { width: 16 }]}>
                  {h % 3 === 0 && (
                    <Text
                      variant="caption"
                      color="textMuted"
                      style={{ fontSize: 9 }}
                    >
                      {h}
                    </Text>
                  )}
                </View>
              ))}
            </View>
            {/* 7 rows, Mon→Sun. */}
            {dayOrder.map((dow) => (
              <View key={dow} style={s.row}>
                <Text
                  variant="caption"
                  color="textMuted"
                  style={{ width: 28, fontSize: 11 }}
                >
                  {dayLabels[dow]}
                </Text>
                {Array.from({ length: 24 }, (_, h) => {
                  const count = heatmap[dow * 24 + h] ?? 0;
                  const intensity = count / max;
                  // 124, 58, 237 = primary purple. Step from 0.15 to 1.
                  const bg =
                    count === 0
                      ? colors.surfaceSecondary
                      : `rgba(124, 58, 237, ${0.15 + intensity * 0.85})`;
                  return (
                    <View
                      key={h}
                      style={{
                        width: 14,
                        height: 14,
                        marginRight: 2,
                        marginBottom: 2,
                        backgroundColor: bg,
                        borderRadius: radius.sm,
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cellSlot: {
    height: 12,
    alignItems: 'center',
  },
});
