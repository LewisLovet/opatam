/**
 * SearchBar Component
 * Search input with icon and clear button
 */

import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';

export interface SearchBarProps {
  /** Current search value */
  value: string;
  /** Value change handler */
  onChangeText: (text: string) => void;
  /** Submit handler (when user presses enter) */
  onSubmit?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Rechercher...',
  autoFocus = false,
}: SearchBarProps) {
  const { colors, spacing, radius, typography } = useTheme();

  const handleClear = () => {
    onChangeText('');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
        },
      ]}
    >
      {/* Search Icon */}
      <Ionicons
        name="search-outline"
        size={20}
        color={colors.textMuted}
        style={{ marginRight: spacing.sm }}
      />

      {/* Input */}
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            fontSize: typography.fontSize.base,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {/* Clear button */}
      {value.length > 0 && (
        <Pressable
          onPress={handleClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [
            styles.clearButton,
            { backgroundColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
