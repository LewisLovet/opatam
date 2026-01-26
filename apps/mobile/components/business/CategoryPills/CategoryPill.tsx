/**
 * CategoryPill Component
 * Individual selectable pill for category filtering
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface CategoryPillProps {
  /** Pill label */
  label: string;
  /** Whether the pill is selected */
  selected: boolean;
  /** Press handler */
  onPress: () => void;
}

export function CategoryPill({ label, selected, onPress }: CategoryPillProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderRadius: radius.full,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        variant="bodySmall"
        color={selected ? 'textInverse' : 'text'}
        style={{ fontWeight: selected ? '600' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
