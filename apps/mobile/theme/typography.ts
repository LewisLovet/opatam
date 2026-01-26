/**
 * Mobile Typography Tokens
 * Font sizes, weights, and line heights optimized for mobile
 */

import { Platform, TextStyle } from 'react-native';

/**
 * Font family configuration
 * Uses system fonts for optimal performance
 */
export const fontFamily = {
  sans: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
} as const;

/**
 * Font weight mapping
 */
export const fontWeight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
} as const;

/**
 * Font sizes (in points)
 */
export const fontSize = {
  /** 10 */
  '2xs': 10,
  /** 12 */
  xs: 12,
  /** 14 */
  sm: 14,
  /** 16 */
  base: 16,
  /** 18 */
  lg: 18,
  /** 20 */
  xl: 20,
  /** 24 */
  '2xl': 24,
  /** 32 */
  '3xl': 32,
  /** 40 */
  '4xl': 40,
  /** 48 */
  '5xl': 48,
} as const;

/**
 * Line heights (in points)
 */
export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

/**
 * Pre-defined text styles
 */
export const textStyles = {
  h1: {
    fontSize: fontSize['3xl'], // 32
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['3xl'] * lineHeight.tight, // ~35
  },
  h2: {
    fontSize: fontSize['2xl'], // 24
    fontWeight: fontWeight.bold,
    lineHeight: fontSize['2xl'] * lineHeight.tight, // ~26
  },
  h3: {
    fontSize: fontSize.xl, // 20
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.xl * lineHeight.snug, // 25
  },
  body: {
    fontSize: fontSize.base, // 16
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.base * lineHeight.normal, // 24
  },
  bodySmall: {
    fontSize: fontSize.sm, // 14
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.sm * lineHeight.normal, // 21
  },
  caption: {
    fontSize: fontSize.xs, // 12
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.xs * lineHeight.normal, // 18
  },
  label: {
    fontSize: fontSize.sm, // 14
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.sm * lineHeight.snug, // ~17.5
  },
} as const;

export type Typography = {
  fontFamily: typeof fontFamily;
  fontWeight: typeof fontWeight;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  textStyles: typeof textStyles;
};

export type TextVariant = keyof typeof textStyles;
