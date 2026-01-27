/**
 * CategoryCard Component
 * Card with background image and gradient overlay for category selection
 * Uses expo-image for smooth loading with blur placeholder
 */

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface CategoryCardProps {
  id: string;
  label: string;
  imageUrl: string;
  onPress: () => void;
}

const PLACEHOLDER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export function CategoryCard({ label, imageUrl, onPress }: CategoryCardProps) {
  const { radius, shadows } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { borderRadius: radius.lg, ...shadows.sm },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { borderRadius: radius.lg }]}
        contentFit="cover"
        placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
        transition={300}
        cachePolicy="memory-disk"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={[styles.gradient, { borderRadius: radius.lg }]}
      >
        <Text variant="body" style={styles.label}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 100,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
  },
  label: {
    color: '#fff',
    fontWeight: '600',
  },
});
