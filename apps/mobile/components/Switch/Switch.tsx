/**
 * Switch Component
 * Toggle on/off with optional label
 */

import React from 'react';
import {
  View,
  Switch as RNSwitch,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export interface SwitchProps {
  /** Switch value */
  value: boolean;
  /** Value change handler */
  onValueChange: (value: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom style for container */
  style?: ViewStyle;
}

export function Switch({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
  style,
}: SwitchProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, style]}>
      {(label || description) && (
        <View style={[styles.labelContainer, { marginRight: spacing.md }]}>
          {label && (
            <Text
              variant="body"
              color={disabled ? 'disabledText' : 'text'}
              style={styles.label}
            >
              {label}
            </Text>
          )}
          {description && (
            <Text
              variant="bodySmall"
              color="textSecondary"
              style={[styles.description, { marginTop: spacing.xs }]}
            >
              {description}
            </Text>
          )}
        </View>
      )}
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border,
          true: colors.primary,
        }}
        thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    // Dynamic styles applied inline
  },
  description: {
    // Dynamic styles applied inline
  },
});
