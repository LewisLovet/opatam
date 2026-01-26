/**
 * Divider Component
 * Horizontal or vertical line separator
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface DividerProps {
  /** Orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Thickness in pixels */
  thickness?: number;
  /** Custom color */
  color?: string;
  /** Spacing above and below (horizontal) or left/right (vertical) */
  spacing?: number;
  /** Custom style */
  style?: ViewStyle;
}

export function Divider({
  orientation = 'horizontal',
  thickness = 1,
  color,
  spacing: spacingProp,
  style,
}: DividerProps) {
  const { colors, spacing } = useTheme();
  const dividerColor = color ?? colors.divider;
  const dividerSpacing = spacingProp ?? spacing.md;

  if (orientation === 'vertical') {
    return (
      <View
        style={[
          styles.vertical,
          {
            width: thickness,
            backgroundColor: dividerColor,
            marginHorizontal: dividerSpacing,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.horizontal,
        {
          height: thickness,
          backgroundColor: dividerColor,
          marginVertical: dividerSpacing,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    width: '100%',
  },
  vertical: {
    alignSelf: 'stretch',
  },
});
