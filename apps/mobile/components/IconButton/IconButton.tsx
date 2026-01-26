/**
 * IconButton Component
 * Circular button with icon, various sizes and variants
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  /** Icon component to render */
  icon: React.ReactNode;
  /** Press handler */
  onPress?: () => void;
  /** Visual variant */
  variant?: IconButtonVariant;
  /** Button size */
  size?: IconButtonSize;
  /** Disabled state */
  disabled?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Accessibility label */
  accessibilityLabel?: string;
}

export function IconButton({
  icon,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  style,
  accessibilityLabel,
}: IconButtonProps) {
  const { colors, radius } = useTheme();

  // Size configurations (ensuring 44x44 minimum for touch targets)
  const sizeConfig: Record<IconButtonSize, { dimension: number }> = {
    sm: { dimension: 36 },
    md: { dimension: 44 },
    lg: { dimension: 52 },
  };

  const { dimension } = sizeConfig[size];

  // Variant styles
  const getVariantStyles = (
    pressed: boolean
  ): { backgroundColor: string; borderWidth?: number; borderColor?: string } => {
    const pressedOpacity = pressed ? 0.8 : 1;

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled
            ? colors.disabled
            : pressed
              ? colors.primaryDark
              : colors.primary,
        };
      case 'secondary':
        return {
          backgroundColor: disabled
            ? colors.disabled
            : pressed
              ? colors.border
              : colors.secondaryLight,
        };
      case 'outline':
        return {
          backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
          borderWidth: 1,
          borderColor: disabled ? colors.disabled : colors.border,
        };
      case 'ghost':
      default:
        return {
          backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
        };
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        return [
          styles.button,
          {
            width: dimension,
            height: dimension,
            borderRadius: radius.full,
            ...variantStyles,
          },
          disabled && styles.disabled,
          style,
        ];
      }}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
