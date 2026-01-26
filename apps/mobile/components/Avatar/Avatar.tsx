/**
 * Avatar Component
 * Displays image or initials with various sizes
 */

import React, { useState } from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Image source URI */
  source?: { uri: string } | null;
  /** Image URL string (alternative to source) */
  imageUrl?: string | null;
  /** Name for generating initials (fallback) */
  name?: string;
  /** Avatar size */
  size?: AvatarSize;
  /** Custom style */
  style?: ViewStyle;
}

/**
 * Generate initials from name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Generate a consistent color based on name
 */
function getColorFromName(name: string): string {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f97316', // orange
    '#22c55e', // green
    '#14b8a6', // teal
    '#6366f1', // indigo
    '#ef4444', // red
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  source,
  imageUrl,
  name = '?',
  size = 'md',
  style,
}: AvatarProps) {
  const { colors, radius } = useTheme();
  const [imageError, setImageError] = useState(false);

  // Size configurations
  const sizeConfig: Record<AvatarSize, { dimension: number; fontSize: number }> =
    {
      sm: { dimension: 32, fontSize: 12 },
      md: { dimension: 40, fontSize: 14 },
      lg: { dimension: 48, fontSize: 18 },
      xl: { dimension: 64, fontSize: 24 },
    };

  const { dimension, fontSize } = sizeConfig[size];

  // Support both source and imageUrl props
  const imageSource = source || (imageUrl ? { uri: imageUrl } : null);
  const showImage = imageSource?.uri && !imageError;
  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: radius.full,
          backgroundColor: showImage ? colors.surfaceSecondary : backgroundColor,
        },
        style,
      ]}
    >
      {showImage && imageSource ? (
        <Image
          source={imageSource}
          style={[
            styles.image,
            {
              width: dimension,
              height: dimension,
              borderRadius: radius.full,
            },
          ]}
          onError={() => setImageError(true)}
        />
      ) : (
        <Text
          variant="body"
          color={colors.textInverse}
          style={[styles.initials, { fontSize }]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontWeight: '600',
  },
});
