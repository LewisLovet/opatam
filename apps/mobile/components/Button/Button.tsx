/**
 * Button Component
 * Variants: primary, secondary, outline, ghost, danger
 * Sizes: sm (36h), md (44h), lg (52h)
 */

import React from 'react';
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /** Button text */
  title: string;
  /** Press handler */
  onPress?: () => void;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Icon component to render on the left */
  leftIcon?: React.ReactNode;
  /** Icon component to render on the right */
  rightIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Custom style */
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();

  const isDisabled = disabled || loading;

  // Size configurations
  const sizeConfig = {
    sm: { height: 36, paddingHorizontal: spacing.md, fontSize: 14 as const },
    md: { height: 44, paddingHorizontal: spacing.lg, fontSize: 16 as const },
    lg: { height: 52, paddingHorizontal: spacing.xl, fontSize: 18 as const },
  };

  const config = sizeConfig[size];

  // Variant styles
  const getVariantStyles = (
    pressed: boolean
  ): { container: ViewStyle; text: TextStyle } => {
    const baseOpacity = pressed ? 0.8 : 1;

    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.disabled : colors.primary,
            opacity: baseOpacity,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.textInverse,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: isDisabled
              ? colors.disabled
              : colors.secondaryLight,
            opacity: baseOpacity,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.secondary,
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: isDisabled ? colors.disabled : colors.primary,
            opacity: baseOpacity,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.primary,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
            opacity: isDisabled ? 0.5 : 1,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.primary,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? colors.disabled : colors.error,
            opacity: baseOpacity,
          },
          text: {
            color: isDisabled ? colors.disabledText : colors.textInverse,
          },
        };
      default:
        return {
          container: {},
          text: {},
        };
    }
  };

  const spinnerColor =
    variant === 'outline' || variant === 'ghost'
      ? colors.primary
      : colors.textInverse;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        return [
          styles.container,
          {
            height: config.height,
            paddingHorizontal: config.paddingHorizontal,
            borderRadius: radius.md,
          },
          variantStyles.container,
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        return (
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator size="small" color={spinnerColor} />
            ) : (
              <>
                {leftIcon && (
                  <View style={[styles.icon, styles.leftIcon]}>{leftIcon}</View>
                )}
                <Text
                  variant={size === 'sm' ? 'bodySmall' : 'body'}
                  style={[
                    styles.text,
                    { fontWeight: '600' },
                    variantStyles.text,
                  ]}
                >
                  {title}
                </Text>
                {rightIcon && (
                  <View style={[styles.icon, styles.rightIcon]}>
                    {rightIcon}
                  </View>
                )}
              </>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});
