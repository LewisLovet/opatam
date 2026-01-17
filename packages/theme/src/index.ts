// Colors
export { colors, lightColors, darkColors } from './colors';
export type { Colors, LightColors, DarkColors } from './colors';

// Typography
export { typography, textStyles } from './typography';
export type { Typography, TextStyles } from './typography';

// Spacing and layout
export {
  spacing,
  borderRadius,
  shadows,
  zIndex,
  breakpoints,
  containers,
} from './spacing';
export type {
  Spacing,
  BorderRadius,
  Shadows,
  ZIndex,
  Breakpoints,
} from './spacing';

/**
 * Complete theme object for use in Tailwind config
 */
export const theme = {
  colors: require('./colors').colors,
  ...require('./typography').typography,
  ...require('./spacing'),
} as const;
