/**
 * Mobile Border Radius Tokens
 */

export const radius = {
  /** 0 */
  none: 0,
  /** 4 */
  sm: 4,
  /** 8 */
  md: 8,
  /** 12 */
  lg: 12,
  /** 16 */
  xl: 16,
  /** 24 */
  '2xl': 24,
  /** Fully rounded (pill shape) */
  full: 9999,
} as const;

export type Radius = typeof radius;
export type RadiusKey = keyof typeof radius;
