/**
 * StarRatingInput Component
 * Interactive star rating input with tap-to-select
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';

export interface StarRatingInputProps {
  /** Current rating value (0-5) */
  value: number;
  /** Callback when rating changes */
  onChange: (rating: number) => void;
  /** Size of stars */
  size?: 'md' | 'lg';
  /** Disabled state */
  disabled?: boolean;
}

const sizeConfig = {
  md: 32,
  lg: 48,
};

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
  disabled = false,
}: StarRatingInputProps) {
  const { spacing } = useTheme();
  const starSize = sizeConfig[size];
  const starColor = '#FBBF24'; // Warning yellow
  const disabledColor = '#D1D5DB';

  const handleStarPress = (starIndex: number) => {
    if (!disabled) {
      // If tapping the same star that's currently selected, allow deselecting
      const newRating = starIndex + 1;
      onChange(newRating === value ? 0 : newRating);
    }
  };

  return (
    <View style={[styles.container, { gap: spacing.sm }]}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Pressable
          key={index}
          onPress={() => handleStarPress(index)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.starButton,
            pressed && !disabled && styles.starButtonPressed,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons
            name={index < value ? 'star' : 'star-outline'}
            size={starSize}
            color={disabled ? disabledColor : starColor}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButton: {
    padding: 4,
  },
  starButtonPressed: {
    transform: [{ scale: 1.15 }],
  },
});
