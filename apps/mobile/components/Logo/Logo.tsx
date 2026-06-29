/**
 * Logo Component
 * Displays the app logo from Firebase Storage with fallback
 */

import React, { useState } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../Text';
import { ASSETS, APP_CONFIG } from '@booking-app/shared/constants';

type LogoVariant = 'default' | 'light' | 'dark';
type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  showText?: boolean;
  subtitle?: string;
  style?: object;
}

const sizeConfig: Record<LogoSize, { logo: number; text: 'body' | 'h3' | 'h2' | 'h1'; subtitle: 'caption' | 'bodySmall' }> = {
  sm: { logo: 24, text: 'body', subtitle: 'caption' },
  md: { logo: 32, text: 'h3', subtitle: 'caption' },
  lg: { logo: 48, text: 'h2', subtitle: 'bodySmall' },
  xl: { logo: 64, text: 'h1', subtitle: 'bodySmall' },
  '2xl': { logo: 96, text: 'h1', subtitle: 'bodySmall' },
  '3xl': { logo: 128, text: 'h1', subtitle: 'bodySmall' },
};

export function Logo({
  variant,
  size = 'md',
  showText = true,
  subtitle,
  style,
}: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const colorScheme = useColorScheme();
  const config = sizeConfig[size];

  // Auto-select variant based on color scheme if not specified
  const effectiveVariant = variant || (colorScheme === 'dark' ? 'light' : 'default');

  // Get the appropriate logo URL
  const logoUrl = ASSETS.logos[effectiveVariant] || ASSETS.logos.default;

  // Fallback to text logo if image fails
  if (imgError) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.fallbackLogo, { width: config.logo, height: config.logo }]}>
          <Text variant="h2" style={styles.fallbackText}>O</Text>
        </View>
        {showText && (
          <View style={styles.textContainer}>
            <Text variant={config.text} style={{ fontWeight: '700' }}>{APP_CONFIG.name}</Text>
            {subtitle && (
              <Text variant={config.subtitle} color="muted">{subtitle}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={logoUrl}
        style={{ width: config.logo, height: config.logo }}
        contentFit="contain"
        transition={300}
        cachePolicy="memory-disk"
        onError={() => setImgError(true)}
      />
      {showText && (
        <View style={styles.textContainer}>
          <Text variant={config.text} style={{ fontWeight: '700' }}>{APP_CONFIG.name}</Text>
          {subtitle && (
            <Text variant={config.subtitle} color="muted">{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// White variant for colored backgrounds
export function LogoWhite({
  variant = 'light',
  size = 'md',
  showText = true,
  subtitle,
  style,
}: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const config = sizeConfig[size];

  const logoUrl = ASSETS.logos[variant] || ASSETS.logos.default;

  if (imgError) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.fallbackLogoWhite, { width: config.logo, height: config.logo }]}>
          <Text variant="h2" style={styles.fallbackTextWhite}>O</Text>
        </View>
        {showText && (
          <View style={styles.textContainer}>
            <Text variant={config.text} style={[styles.whiteText, { fontWeight: '700' }]}>{APP_CONFIG.name}</Text>
            {subtitle && (
              <Text variant={config.subtitle} style={styles.subtitleWhite}>{subtitle}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={logoUrl}
        style={{ width: config.logo, height: config.logo }}
        contentFit="contain"
        transition={300}
        cachePolicy="memory-disk"
        onError={() => setImgError(true)}
      />
      {showText && (
        <View style={styles.textContainer}>
          <Text variant={config.text} style={[styles.whiteText, { fontWeight: '700' }]}>{APP_CONFIG.name}</Text>
          {subtitle && (
            <Text variant={config.subtitle} style={styles.subtitleWhite}>{subtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textContainer: {
    flexDirection: 'column',
  },
  fallbackLogo: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackLogoWhite: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fallbackTextWhite: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  whiteText: {
    color: '#FFFFFF',
  },
  subtitleWhite: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
