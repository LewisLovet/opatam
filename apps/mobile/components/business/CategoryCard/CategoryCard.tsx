/**
 * CategoryCard Component
 * Card with background image and gradient overlay for category selection
 */

import React from 'react';
import { Pressable, ImageBackground, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface CategoryCardProps {
  id: string;
  label: string;
  imageUrl: string;
  onPress: () => void;
}

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
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.image}
        imageStyle={{ borderRadius: radius.lg }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={[styles.gradient, { borderRadius: radius.lg }]}
        >
          <Text variant="body" style={styles.label}>
            {label}
          </Text>
        </LinearGradient>
      </ImageBackground>
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
    flex: 1,
    justifyContent: 'flex-end',
  },
  gradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  label: {
    color: '#fff',
    fontWeight: '600',
  },
});
