/**
 * ThemeContext - Dynamic theme configuration for mobile
 * Allows runtime theme customization via the DevFAB configurator
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { colors as defaultColors, palette, Colors } from './colors';
import { spacing, Spacing } from './spacing';
import { radius, Radius } from './radius';
import { shadows, Shadows } from './shadows';
import {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  textStyles,
  Typography,
} from './typography';

/**
 * Theme configuration that can be customized
 */
export interface ThemeConfig {
  /** Primary color override */
  primaryColor?: string;
  /** Primary light color override */
  primaryLightColor?: string;
  /** Primary dark color override */
  primaryDarkColor?: string;
  /** Border radius multiplier (0.5 = compact, 1 = normal, 1.5 = rounded) */
  radiusMultiplier?: number;
  /** Spacing multiplier (0.8 = compact, 1 = normal, 1.2 = spacious) */
  spacingMultiplier?: number;
}

/**
 * Complete theme object
 */
export interface Theme {
  colors: Colors;
  spacing: Spacing;
  radius: Radius;
  shadows: Shadows;
  typography: Typography;
}

/**
 * Theme context value
 */
interface ThemeContextValue {
  theme: Theme;
  config: ThemeConfig;
  updateConfig: (newConfig: Partial<ThemeConfig>) => void;
  resetConfig: () => void;
}

const defaultConfig: ThemeConfig = {
  primaryColor: undefined,
  primaryLightColor: undefined,
  primaryDarkColor: undefined,
  radiusMultiplier: 1,
  spacingMultiplier: 1,
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Apply spacing multiplier to spacing tokens
 */
const applySpacingMultiplier = (
  baseSpacing: Spacing,
  multiplier: number
): Spacing => {
  if (multiplier === 1) return baseSpacing;

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(baseSpacing)) {
    result[key] = Math.round(value * multiplier);
  }
  return result as unknown as Spacing;
};

/**
 * Apply radius multiplier to radius tokens
 */
const applyRadiusMultiplier = (
  baseRadius: Radius,
  multiplier: number
): Radius => {
  if (multiplier === 1) return baseRadius;

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(baseRadius)) {
    // Don't multiply 'full' value
    if (key === 'full') {
      result[key] = value;
    } else {
      result[key] = Math.round(value * multiplier);
    }
  }
  return result as unknown as Radius;
};

/**
 * Build theme from config
 */
const buildTheme = (config: ThemeConfig): Theme => {
  // Apply color overrides
  const themeColors = {
    ...defaultColors,
    ...(config.primaryColor && { primary: config.primaryColor }),
    ...(config.primaryLightColor && { primaryLight: config.primaryLightColor }),
    ...(config.primaryDarkColor && { primaryDark: config.primaryDarkColor }),
  } as Colors;

  // Apply multipliers
  const themeSpacing = applySpacingMultiplier(
    spacing,
    config.spacingMultiplier ?? 1
  );
  const themeRadius = applyRadiusMultiplier(
    radius,
    config.radiusMultiplier ?? 1
  );

  return {
    colors: themeColors,
    spacing: themeSpacing,
    radius: themeRadius,
    shadows,
    typography: {
      fontFamily,
      fontWeight,
      fontSize,
      lineHeight,
      textStyles,
    },
  };
};

/**
 * ThemeProvider component
 */
interface ThemeProviderProps {
  children: ReactNode;
  initialConfig?: ThemeConfig;
}

export function ThemeProvider({
  children,
  initialConfig = defaultConfig,
}: ThemeProviderProps) {
  const [config, setConfig] = useState<ThemeConfig>({
    ...defaultConfig,
    ...initialConfig,
  });

  const updateConfig = useCallback((newConfig: Partial<ThemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfig(defaultConfig);
  }, []);

  const theme = useMemo(() => buildTheme(config), [config]);

  const value = useMemo(
    () => ({
      theme,
      config,
      updateConfig,
      resetConfig,
    }),
    [theme, config, updateConfig, resetConfig]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access theme
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default theme if used outside provider
    return buildTheme(defaultConfig);
  }
  return context.theme;
}

/**
 * Hook to access theme config and update functions
 */
export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeConfig must be used within a ThemeProvider');
  }
  return {
    config: context.config,
    updateConfig: context.updateConfig,
    resetConfig: context.resetConfig,
  };
}

/**
 * Preset primary colors for the configurator
 */
export const primaryColorPresets = [
  { name: 'Bleu (défaut)', color: palette.primary[600] },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Violet', color: '#8b5cf6' },
  { name: 'Rose', color: '#ec4899' },
  { name: 'Rouge', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Vert', color: '#22c55e' },
  { name: 'Turquoise', color: '#14b8a6' },
  { name: 'Cyan', color: '#06b6d4' },
] as const;

/**
 * Generate light and dark variants from a primary color
 */
export function generateColorVariants(primaryColor: string): {
  primary: string;
  primaryLight: string;
  primaryDark: string;
} {
  // Simple approximation - in production you'd use a proper color library
  return {
    primary: primaryColor,
    primaryLight: `${primaryColor}20`, // 20% opacity for light variant
    primaryDark: primaryColor, // Would need color manipulation for true dark
  };
}
