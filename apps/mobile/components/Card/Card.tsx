/**
 * Card Component
 * Container with shadow, padding, and optional press handler
 */

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme, ShadowKey, SpacingKey } from '../../theme';

export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Shadow size */
  shadow?: ShadowKey;
  /** Press handler - makes card pressable */
  onPress?: () => void;
  /** Custom style */
  style?: ViewStyle;
}

export function Card({
  children,
  padding = 'md',
  shadow = 'sm',
  onPress,
  style,
}: CardProps) {
  const { colors, radius, spacing, shadows } = useTheme();

  // Padding mapping
  const paddingMap: Record<string, number> = {
    none: 0,
    sm: spacing.sm,
    md: spacing.lg,
    lg: spacing['2xl'],
  };

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: paddingMap[padding],
    ...shadows[shadow],
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          cardStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    // Note: overflow: 'hidden' is removed because it clips shadows on iOS
    // If you need clipping for content, apply it to an inner View
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
