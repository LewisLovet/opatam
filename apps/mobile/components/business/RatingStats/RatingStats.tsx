/**
 * RatingStats Component
 * Global rating statistics with distribution bars
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { StarRating } from '../StarRating';

export interface RatingStatsProps {
  /** Average rating (e.g., 4.6) */
  average: number;
  /** Total number of reviews */
  count: number;
  /** Distribution of ratings by star count */
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export function RatingStats({ average, count, distribution }: RatingStatsProps) {
  const { colors, spacing, radius } = useTheme();

  // Calculate total and percentages
  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);

  const getPercentage = (starCount: number): number => {
    if (total === 0) return 0;
    return (distribution[starCount as keyof typeof distribution] / total) * 100;
  };

  return (
    <View style={styles.container}>
      {/* Left: Average rating */}
      <View style={[styles.averageSection, { marginRight: spacing.lg }]}>
        <Text variant="h1" style={styles.averageValue}>
          {average.toFixed(1)}
        </Text>
        <StarRating rating={average} size="md" />
        <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
          ({count} avis)
        </Text>
      </View>

      {/* Right: Distribution bars */}
      <View style={styles.distributionSection}>
        {[5, 4, 3, 2, 1].map((star) => {
          const percentage = getPercentage(star);
          const starCount = distribution[star as keyof typeof distribution];

          return (
            <View key={star} style={[styles.barRow, { marginBottom: spacing.xs }]}>
              {/* Star label */}
              <View style={styles.starLabel}>
                <Text variant="caption" color="textSecondary">
                  {star}
                </Text>
                <Ionicons
                  name="star"
                  size={12}
                  color="#FBBF24"
                  style={{ marginLeft: 2 }}
                />
              </View>

              {/* Progress bar */}
              <View
                style={[
                  styles.barBackground,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.sm,
                  },
                ]}
              >
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${percentage}%`,
                      backgroundColor: colors.primary,
                      borderRadius: radius.sm,
                    },
                  ]}
                />
              </View>

              {/* Count */}
              <Text variant="caption" color="textMuted" style={styles.countLabel}>
                {starCount}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  averageSection: {
    alignItems: 'center',
    minWidth: 80,
  },
  averageValue: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700',
  },
  distributionSection: {
    flex: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 28,
  },
  barBackground: {
    flex: 1,
    height: 8,
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
  },
  countLabel: {
    width: 24,
    textAlign: 'right',
  },
});
