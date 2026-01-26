/**
 * StarRating Component
 * Read-only star rating display with support for half stars
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface StarRatingProps {
  /** Rating value (0-5, accepts decimals like 4.5) */
  rating: number;
  /** Size of stars */
  size?: 'sm' | 'md' | 'lg';
  /** Show numeric value next to stars */
  showValue?: boolean;
  /** Custom star color (defaults to warning/yellow) */
  color?: string;
}

const sizeConfig = {
  sm: 14,
  md: 18,
  lg: 24,
};

export function StarRating({
  rating,
  size = 'md',
  showValue = false,
  color,
}: StarRatingProps) {
  const { colors, spacing } = useTheme();
  const starSize = sizeConfig[size];
  const starColor = color || '#FBBF24'; // Warning yellow

  // Clamp rating between 0 and 5
  const clampedRating = Math.max(0, Math.min(5, rating));

  const renderStar = (index: number) => {
    const starValue = index + 1;
    const diff = clampedRating - index;

    if (diff >= 1) {
      // Full star
      return (
        <Ionicons
          key={index}
          name="star"
          size={starSize}
          color={starColor}
        />
      );
    } else if (diff >= 0.5) {
      // Half star - use half icon
      return (
        <Ionicons
          key={index}
          name="star-half"
          size={starSize}
          color={starColor}
        />
      );
    } else {
      // Empty star
      return (
        <Ionicons
          key={index}
          name="star-outline"
          size={starSize}
          color={starColor}
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.starsContainer, { gap: size === 'sm' ? 1 : 2 }]}>
        {[0, 1, 2, 3, 4].map(renderStar)}
      </View>
      {showValue && (
        <Text
          variant={size === 'lg' ? 'body' : 'bodySmall'}
          style={[styles.value, { marginLeft: spacing.xs }]}
        >
          {clampedRating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontWeight: '600',
  },
});
