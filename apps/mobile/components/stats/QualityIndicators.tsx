import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../../components';
import { useTheme } from '../../theme';

/**
 * Three-tile band: cancellation rate, no-show rate, average rating.
 * Cancellation / no-show flip to amber when above the warning
 * threshold (10% / 5%) so problem rates jump out without forcing
 * the provider to read every number.
 */
export function QualityIndicators({
  cancellationRate,
  noshowRate,
  averageRating,
  ratingCount,
}: {
  cancellationRate: number; // 0..1
  noshowRate: number; // 0..1
  averageRating: number | null;
  ratingCount: number;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
      <Text variant="h3" style={{ marginBottom: spacing.md }}>
        Indicateurs qualité
      </Text>
      <View style={[s.grid, { gap: spacing.sm }]}>
        <Tile
          icon="close-circle-outline"
          label="Annulation"
          value={`${(cancellationRate * 100).toFixed(1)}%`}
          warn={cancellationRate > 0.1}
          colors={colors}
          radius={radius.md}
        />
        <Tile
          icon="alert-circle-outline"
          label="No-show"
          value={`${(noshowRate * 100).toFixed(1)}%`}
          warn={noshowRate > 0.05}
          colors={colors}
          radius={radius.md}
        />
        <Tile
          icon="star"
          label="Note moyenne"
          value={
            averageRating === null ? '—' : `${averageRating.toFixed(1)} / 5`
          }
          sublabel={ratingCount > 0 ? `${ratingCount} avis` : 'aucun avis'}
          warn={false}
          colors={colors}
          radius={radius.md}
        />
      </View>
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
  sublabel,
  warn,
  colors,
  radius,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sublabel?: string;
  warn: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  radius: number;
}) {
  return (
    <View
      style={[
        s.tile,
        { backgroundColor: colors.surfaceSecondary, borderRadius: radius },
      ]}
    >
      <View style={s.tileHeader}>
        <Ionicons
          name={icon}
          size={14}
          color={warn ? colors.warning : colors.textMuted}
        />
        <Text
          variant="caption"
          color="textMuted"
          style={{ fontSize: 11 }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        variant="h3"
        style={{
          fontWeight: '800',
          color: warn ? colors.warning : colors.text,
        }}
      >
        {value}
      </Text>
      {sublabel && (
        <Text variant="caption" color="textMuted" style={{ fontSize: 10 }}>
          {sublabel}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  tile: {
    flex: 1,
    padding: 12,
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
});
