/**
 * Input Component
 * TextInput with label, error state, helper text, and icons
 */

import React, { useState, useRef, useId } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Pressable,
  Animated,
  InputAccessoryView,
  Keyboard,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Input label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Value change handler */
  onChangeText?: (text: string) => void;
  /** Error message - shows error state when provided */
  error?: string;
  /** Helper text shown below input */
  helperText?: string;
  /** Icon component for left side */
  leftIcon?: React.ReactNode;
  /** Icon component for right side (e.g., eye toggle for password) */
  rightIcon?: React.ReactNode;
  /** Right icon press handler */
  onRightIconPress?: () => void;
  /** Password input */
  secureTextEntry?: boolean;
  /** Keyboard type */
  keyboardType?: TextInputProps['keyboardType'];
  /** Auto capitalize setting */
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Disabled state */
  disabled?: boolean;
  /** Multiline input */
  multiline?: boolean;
  /** Number of lines for multiline */
  numberOfLines?: number;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  ...props
}: InputProps) {
  const { colors, radius, spacing, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const accessoryId = useId();

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const hasError = !!error;
  const borderColor = hasError
    ? colors.error
    : isFocused
      ? colors.borderFocused
      : colors.border;

  const backgroundColor = disabled ? colors.surfaceSecondary : colors.surface;

  const animatedBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [hasError ? colors.error : colors.border, hasError ? colors.error : colors.borderFocused],
  });

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text
          variant="label"
          color={hasError ? 'error' : 'text'}
          style={[styles.label, { marginBottom: spacing.xs }]}
        >
          {label}
        </Text>
      )}

      <Animated.View
        style={[
          styles.container,
          {
            borderColor: animatedBorderColor,
            borderRadius: radius.md,
            backgroundColor,
            minHeight: multiline ? 80 : 44,
            alignItems: multiline ? 'flex-start' : 'center',
          },
          disabled && styles.disabled,
        ]}
      >
        {leftIcon && (
          <View style={[styles.iconContainer, { paddingLeft: spacing.md }]}>
            {leftIcon}
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            {
              color: disabled ? colors.disabledText : colors.text,
              fontSize: typography.fontSize.base,
              paddingHorizontal: spacing.md,
              paddingVertical: multiline ? spacing.sm : spacing.md,
            },
            leftIcon ? { paddingLeft: spacing.xs } : undefined,
            rightIcon ? { paddingRight: spacing.xs } : undefined,
            multiline ? styles.multilineInput : undefined,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? 'top' : 'center'}
          returnKeyType={multiline ? undefined : 'done'}
          inputAccessoryViewID={multiline && Platform.OS === 'ios' ? accessoryId : undefined}
          {...props}
        />

        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            style={[styles.iconContainer, { paddingRight: spacing.md }]}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {rightIcon}
          </Pressable>
        )}
      </Animated.View>

      {(error || helperText) && (
        <Text
          variant="caption"
          color={hasError ? 'error' : 'textSecondary'}
          style={[styles.helperText, { marginTop: spacing.xs }]}
        >
          {error || helperText}
        </Text>
      )}

      {multiline && Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={[styles.accessoryBar, { borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Pressable onPress={() => Keyboard.dismiss()} style={styles.accessoryBtn} hitSlop={8}>
              <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    // Dynamic styles applied inline
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    minHeight: 44,
  },
  multilineInput: {
    textAlignVertical: 'top',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    // Dynamic styles applied inline
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accessoryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
