/**
 * Mobile Spacing Tokens
 * Based on 4-point grid system
 */

export const spacing = {
  /** 0 */
  none: 0,
  /** 4 */
  xs: 4,
  /** 8 */
  sm: 8,
  /** 12 */
  md: 12,
  /** 16 */
  lg: 16,
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
  /** 64 */
  '6xl': 64,
  /** 80 */
  '7xl': 80,
  /** 96 */
  '8xl': 96,
} as const;

export type Spacing = typeof spacing;
export type SpacingKey = keyof typeof spacing;
