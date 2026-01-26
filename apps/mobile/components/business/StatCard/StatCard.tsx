/**
 * StatCard Component
 * Dashboard stat card for Pro mode with optional trend indicator
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Card } from '../../Card';

export interface StatCardProps {
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap;
  /** Stat label (e.g., "RDV aujourd'hui") */
  label: string;
  /** Stat value (e.g., "8" or "4.8") */
  value: string | number;
  /** Optional trend indicator */
  trend?: {
    /** Trend value (e.g., +12 or -5) */
    value: number;
    /** Whether the trend is positive (green) or negative (red) */
    isPositive: boolean;
  };
  /** Press handler */
  onPress?: () => void;
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  onPress,
}: StatCardProps) {
  const { colors, spacing, radius } = useTheme();

  const content = (
    <>
      {/* Icon with background */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: colors.primaryLight,
            borderRadius: radius.full,
            width: 40,
            height: 40,
            marginBottom: spacing.sm,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>

      {/* Label */}
      <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>
        {label}
      </Text>

      {/* Value */}
      <Text variant="h2" style={styles.value}>
        {value}
      </Text>

      {/* Trend indicator */}
      {trend && (
        <View
          style={[
            styles.trendBadge,
            {
              backgroundColor: trend.isPositive ? colors.successLight : colors.errorLight,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radius.sm,
              marginTop: spacing.sm,
            },
          ]}
        >
          <Ionicons
            name={trend.value >= 0 ? 'trending-up' : 'trending-down'}
            size={12}
            color={trend.isPositive ? colors.successDark : colors.errorDark}
          />
          <Text
            variant="caption"
            style={{
              color: trend.isPositive ? colors.successDark : colors.errorDark,
              marginLeft: 4,
              fontWeight: '600',
            }}
          >
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Card padding="md" shadow="sm" onPress={onPress}>
        <View style={styles.content}>{content}</View>
      </Card>
    );
  }

  return (
    <Card padding="md" shadow="sm">
      <View style={styles.content}>{content}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'flex-start',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '700',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
