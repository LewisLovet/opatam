/**
 * Toast Component
 * Animated notification toast with variants
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Pressable, View, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  /** Toast message */
  message: string;
  /** Toast variant */
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
  /** Whether the toast is visible */
  visible: boolean;
}

const ANIMATION_DURATION = 300;

export function Toast({
  message,
  variant = 'info',
  duration = 3000,
  onDismiss,
  visible,
}: ToastProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Variant configurations
  const variantConfig: Record<
    ToastVariant,
    {
      backgroundColor: string;
      borderColor: string;
      iconColor: string;
      icon: keyof typeof Ionicons.glyphMap;
    }
  > = {
    success: {
      backgroundColor: colors.successLight,
      borderColor: colors.success,
      iconColor: colors.successDark,
      icon: 'checkmark-circle',
    },
    error: {
      backgroundColor: colors.errorLight,
      borderColor: colors.error,
      iconColor: colors.errorDark,
      icon: 'close-circle',
    },
    warning: {
      backgroundColor: colors.warningLight,
      borderColor: colors.warning,
      iconColor: colors.warningDark,
      icon: 'alert-circle',
    },
    info: {
      backgroundColor: colors.infoLight,
      borderColor: colors.info,
      iconColor: colors.infoDark,
      icon: 'information-circle',
    },
  };

  const config = variantConfig[variant];

  // Show/hide animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: ANIMATION_DURATION,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Auto-dismiss timer
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + spacing.sm,
          marginHorizontal: spacing.lg,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Pressable onPress={onDismiss}>
        <View
          style={[
            styles.toast,
            {
              backgroundColor: config.backgroundColor,
              borderColor: config.borderColor,
              borderRadius: radius.lg,
              padding: spacing.md,
              paddingHorizontal: spacing.lg,
            },
            shadows.md,
          ]}
        >
          <Ionicons
            name={config.icon}
            size={22}
            color={config.iconColor}
            style={{ marginRight: spacing.md }}
          />
          <Text
            variant="body"
            color={config.iconColor}
            style={styles.message}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  message: {
    flex: 1,
    fontWeight: '500',
  },
});
