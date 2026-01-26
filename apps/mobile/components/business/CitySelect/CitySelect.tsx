/**
 * CitySelect Component
 * City picker with modal selection
 */

import React, { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Divider } from '../../Divider';

export interface CitySelectProps {
  /** Currently selected city (null = all cities) */
  value: string | null;
  /** Available cities */
  cities: string[];
  /** Change handler */
  onChange: (city: string | null) => void;
  /** Placeholder text */
  placeholder?: string;
}

export function CitySelect({
  value,
  cities,
  onChange,
  placeholder = 'Toutes les villes',
}: CitySelectProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (city: string | null) => {
    onChange(city);
    setIsOpen(false);
  };

  const displayValue = value || placeholder;

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
          },
          pressed && { backgroundColor: colors.surfaceSecondary },
        ]}
      >
        <Ionicons
          name="location-outline"
          size={20}
          color={value ? colors.primary : colors.textMuted}
          style={{ marginRight: spacing.sm }}
        />
        <Text
          variant="body"
          color={value ? 'text' : 'textMuted'}
          style={styles.triggerText}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {/* Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
            ]}
          >
            <Text variant="h3">Choisir une ville</Text>
            <Pressable
              onPress={() => setIsOpen(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Divider spacing={0} />

          {/* Options List */}
          <FlatList
            data={[null, ...cities]}
            keyExtractor={(item) => item || 'all'}
            renderItem={({ item }) => {
              const isSelected = item === value;
              const label = item || 'Toutes les villes';

              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.option,
                    { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
                    pressed && { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <Text
                    variant="body"
                    color={isSelected ? 'primary' : 'text'}
                    style={{ fontWeight: isSelected ? '600' : '400' }}
                  >
                    {label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <Divider spacing={0} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  triggerText: {
    flex: 1,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
});
