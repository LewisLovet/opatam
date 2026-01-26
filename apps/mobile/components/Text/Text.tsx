/**
 * Text Component
 * Typography variants: h1, h2, h3, body, bodySmall, caption, label
 */

import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme, TextVariant, ColorKey } from '../../theme';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** Typography variant */
  variant?: TextVariant;
  /** Text color - can be a theme color key or custom color */
  color?: ColorKey | string;
  /** Text alignment */
  align?: TextStyle['textAlign'];
  /** Custom style overrides - accepts single style or array */
  style?: StyleProp<TextStyle>;
  /** Children content */
  children: React.ReactNode;
}

export function Text({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...props
}: TextProps) {
  const { colors, typography } = useTheme();
  const textStyle = typography.textStyles[variant];

  // Resolve color - check if it's a theme color key or custom color
  const resolvedColor = color
    ? (colors as unknown as Record<string, string>)[color] ?? color
    : colors.text;

  return (
    <RNText
      style={[
        styles.base,
        {
          fontSize: textStyle.fontSize,
          fontWeight: textStyle.fontWeight,
          lineHeight: textStyle.lineHeight,
          color: resolvedColor,
          textAlign: align,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    // Base styles applied to all text
  },
});
