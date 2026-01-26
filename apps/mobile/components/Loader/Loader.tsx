/**
 * Loader Component
 * ActivityIndicator and Skeleton loading states
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../theme';

export type LoaderSize = 'sm' | 'md' | 'lg';

export interface LoaderProps {
  /** Loader size */
  size?: LoaderSize;
  /** Custom color */
  color?: string;
  /** Custom style */
  style?: ViewStyle;
}

export function Loader({ size = 'md', color, style }: LoaderProps) {
  const { colors } = useTheme();
  const loaderColor = color ?? colors.primary;

  // Map size to ActivityIndicator size
  const sizeMap: Record<LoaderSize, 'small' | 'large'> = {
    sm: 'small',
    md: 'small',
    lg: 'large',
  };

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={sizeMap[size]} color={loaderColor} />
    </View>
  );
}

/**
 * Skeleton Loader
 * Animated placeholder for loading content
 */
export interface SkeletonProps {
  /** Width (number for pixels, string for percentage) */
  width?: number | string;
  /** Height in pixels */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** Circle shape (ignores width, uses height for diameter) */
  circle?: boolean;
  /** Custom style */
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  circle = false,
  style,
}: SkeletonProps) {
  const { colors, radius } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const dimension = circle ? height : undefined;
  const resolvedRadius = circle
    ? height / 2
    : borderRadius ?? radius.sm;

  const resolvedWidth = circle ? dimension : width;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: resolvedWidth as number | `${number}%` | 'auto',
          height,
          borderRadius: resolvedRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeleton: {
    overflow: 'hidden',
  },
});
