/**
 * CategorySelect Component
 * Category picker with modal selection — supports full list of categories
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

export interface CategoryOption {
  id: string;
  label: string;
}

export interface CategorySelectProps {
  /** Currently selected category id (null = all categories) */
  value: string | null;
  /** Available categories */
  categories: CategoryOption[];
  /** Change handler */
  onChange: (categoryId: string | null) => void;
  /** Placeholder text */
  placeholder?: string;
}

export function CategorySelect({
  value,
  categories,
  onChange,
  placeholder = 'Toutes les catégories',
}: CategorySelectProps) {
  const { colors, spacing, radius } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setIsOpen(false);
  };

  const selectedLabel = value
    ? categories.find((c) => c.id === value)?.label || value
    : placeholder;

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
          name="grid-outline"
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
          {selectedLabel}
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
            <Text variant="h3">Choisir une catégorie</Text>
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
            data={[null, ...categories]}
            keyExtractor={(item) => item?.id || 'all'}
            renderItem={({ item }) => {
              const isSelected = item ? item.id === value : value === null;
              const label = item ? item.label : 'Toutes les catégories';

              return (
                <Pressable
                  onPress={() => handleSelect(item?.id ?? null)}
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
