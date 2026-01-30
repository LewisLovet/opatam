/**
 * StickyConfirmButton Component
 * Fixed bottom button for confirming time slot selection
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface StickyConfirmButtonProps {
  /** Selected time (e.g., "14:30") */
  selectedTime: string | null;
  /** Callback when confirm button is pressed */
  onConfirm: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
}

export function StickyConfirmButton({
  selectedTime,
  onConfirm,
  disabled = false,
  loading = false,
}: StickyConfirmButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  // Format time for display (14:30 -> 14h30)
  const formattedTime = selectedTime?.replace(':', 'h') || null;

  const isDisabled = disabled || loading || !selectedTime;

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onConfirm}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: isDisabled ? colors.surfaceSecondary : colors.primary,
            borderRadius: radius.lg,
            opacity: pressed && !isDisabled ? 0.9 : 1,
          },
        ]}
      >
        <Text
          variant="body"
          style={[
            styles.buttonText,
            { color: isDisabled ? colors.textMuted : '#FFFFFF' },
          ]}
        >
          {loading
            ? 'Chargement...'
            : selectedTime
            ? `Confirmer - ${formattedTime}`
            : 'Sélectionnez un horaire'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  button: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
