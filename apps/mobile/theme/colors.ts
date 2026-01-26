/**
 * Mobile Color Tokens
 * Aligned with web theme for visual consistency
 */

export const palette = {
  // Primary (Blue - Brand Color)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Gray (Neutral Base)
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },

  // Success (Green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  // Warning (Amber)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  // Error (Red)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Info (Blue - same as primary)
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Pure colors
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

/**
 * Semantic colors for light theme (mobile-first)
 */
export const colors = {
  // Primary (using darker blue for better visibility)
  primary: palette.primary[700],
  primaryLight: palette.primary[50],
  primaryDark: palette.primary[900],

  // Secondary (using gray)
  secondary: palette.gray[600],
  secondaryLight: palette.gray[100],
  secondaryDark: palette.gray[800],

  // Backgrounds
  background: palette.white,
  surface: palette.white,
  surfaceSecondary: palette.gray[50],

  // Text
  text: palette.gray[900],
  textSecondary: palette.gray[600],
  textMuted: palette.gray[400],
  textInverse: palette.white,

  // Borders & Dividers
  border: palette.gray[200],
  borderFocused: palette.primary[600],
  divider: palette.gray[100],

  // Semantic
  error: palette.error[500],
  errorLight: palette.error[100], // More visible: #fee2e2
  errorDark: palette.error[800],  // Darker for text: #991b1b

  success: palette.success[500],
  successLight: palette.success[100], // More visible: #dcfce7 -> using D1FAE5 equivalent
  successDark: palette.success[800],  // Darker for text: #166534 -> using #065F46

  warning: palette.warning[500],
  warningLight: palette.warning[100], // More visible: #fef3c7
  warningDark: palette.warning[800],  // Darker for text: #92400e

  info: palette.info[500],
  infoLight: palette.info[100], // More visible: #dbeafe
  infoDark: palette.info[800],  // Darker for text: #1e40af

  // Utility
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: palette.gray[300],
  disabledText: palette.gray[400],

  // Keep palette reference for custom needs
  palette,
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof typeof colors;
