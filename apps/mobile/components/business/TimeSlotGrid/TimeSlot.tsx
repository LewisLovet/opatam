/**
 * TimeSlot Component
 * Individual time slot button
 */

import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface TimeSlotProps {
  /** Time string (e.g. "14:30") */
  time: string;
  /** Whether the slot is available */
  available: boolean;
  /** Whether the slot is selected */
  selected: boolean;
  /** Press handler */
  onPress: () => void;
}

export function TimeSlot({ time, available, selected, onPress }: TimeSlotProps) {
  const { colors, spacing, radius } = useTheme();

  const backgroundColor = selected
    ? colors.primary
    : available
    ? colors.surface
    : colors.surfaceSecondary;

  const borderColor = selected
    ? colors.primary
    : available
    ? colors.border
    : colors.surfaceSecondary;

  const textColor = selected
    ? 'textInverse'
    : available
    ? 'text'
    : 'textMuted';

  return (
    <Pressable
      onPress={onPress}
      disabled={!available}
      style={({ pressed }) => [
        styles.container,
        {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          backgroundColor,
          borderColor,
          opacity: pressed && available ? 0.9 : 1,
        },
      ]}
    >
      <Text variant="body" color={textColor} style={styles.time}>
        {time}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  time: {
    fontWeight: '500',
  },
});
