/**
 * Mobile Shadow Tokens
 * Platform-specific shadow implementations for iOS and Android
 */

import { Platform, ViewStyle } from 'react-native';

type ShadowStyle = {
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
};

/**
 * Creates a cross-platform shadow style
 * Both iOS and Android properties are always included for consistency
 */
const createShadow = (
  elevation: number,
  shadowOffset: { width: number; height: number },
  shadowOpacity: number,
  shadowRadius: number
): ShadowStyle => {
  if (elevation === 0) {
    return {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    };
  }

  return {
    // iOS shadow properties
    shadowColor: '#000000',
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    // Android elevation
    elevation,
  };
};

export const shadows = {
  /** No shadow */
  none: createShadow(0, { width: 0, height: 0 }, 0, 0),

  /** Small shadow - subtle elevation */
  sm: createShadow(2, { width: 0, height: 1 }, 0.08, 3),

  /** Medium shadow - cards, buttons */
  md: createShadow(4, { width: 0, height: 2 }, 0.12, 6),

  /** Large shadow - modals, FAB */
  lg: createShadow(8, { width: 0, height: 4 }, 0.16, 10),

  /** Extra large shadow - overlays */
  xl: createShadow(12, { width: 0, height: 6 }, 0.20, 14),

  /** 2XL shadow - dropdowns, tooltips */
  '2xl': createShadow(16, { width: 0, height: 8 }, 0.24, 18),
} as const;

export type Shadows = typeof shadows;
export type ShadowKey = keyof typeof shadows;
