/**
 * Mobile Theme - Main Export
 *
 * Usage:
 * import { colors, spacing, useTheme } from '@/theme';
 */

// Token exports
export { colors, palette, type Colors, type ColorKey } from './colors';
export { spacing, type Spacing, type SpacingKey } from './spacing';
export {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  textStyles,
  type Typography,
  type TextVariant,
} from './typography';
export { shadows, type Shadows, type ShadowKey } from './shadows';
export { radius, type Radius, type RadiusKey } from './radius';

// Theme context exports
export {
  ThemeProvider,
  useTheme,
  useThemeConfig,
  primaryColorPresets,
  generateColorVariants,
  type Theme,
  type ThemeConfig,
} from './ThemeContext';
