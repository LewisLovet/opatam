/**
 * Badge Component
 * Status badges: success, warning, error, info, neutral
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  /** Badge text */
  label: string;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Custom style */
  style?: ViewStyle;
}

export function Badge({
  label,
  variant = 'neutral',
  size = 'md',
  style,
}: BadgeProps) {
  const { colors, radius, spacing } = useTheme();

  // Variant colors
  const variantStyles: Record<
    BadgeVariant,
    { backgroundColor: string; textColor: string }
  > = {
    success: {
      backgroundColor: colors.successLight,
      textColor: colors.successDark,
    },
    warning: {
      backgroundColor: colors.warningLight,
      textColor: colors.warningDark,
    },
    error: {
      backgroundColor: colors.errorLight,
      textColor: colors.errorDark,
    },
    info: {
      backgroundColor: colors.infoLight,
      textColor: colors.infoDark,
    },
    neutral: {
      backgroundColor: colors.surfaceSecondary,
      textColor: colors.textSecondary,
    },
  };

  const { backgroundColor, textColor } = variantStyles[variant];

  // Size configurations
  const sizeStyles: Record<
    BadgeSize,
    { paddingHorizontal: number; paddingVertical: number }
  > = {
    sm: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
    md: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  };

  const { paddingHorizontal, paddingVertical } = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          borderRadius: radius.full,
          paddingHorizontal,
          paddingVertical,
        },
        style,
      ]}
    >
      <Text
        variant={size === 'sm' ? 'caption' : 'bodySmall'}
        color={textColor}
        style={styles.text}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '500',
  },
});
