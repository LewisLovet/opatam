/**
 * CategorySelect Component
 * Modern category picker with search and card-style items with icons
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface CategoryOption {
  id: string;
  label: string;
  icon?: string;
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
  const [search, setSearch] = useState('');

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearch('');
  };

  const selectedLabel = value
    ? categories.find((c) => c.id === value)?.label || value
    : placeholder;

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return categories.filter((c) =>
      c.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
  }, [categories, search]);

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: value ? `${colors.primary}10` : colors.surface,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: value ? `${colors.primary}30` : colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text
          variant="label"
          color={value ? 'primary' : 'textSecondary'}
          style={{ fontWeight: value ? '600' : '500', flex: 1 }}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={value ? colors.primary : colors.textMuted}
        />
      </Pressable>

      {/* Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setIsOpen(false); setSearch(''); }}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }]}>
            <Text variant="h3" style={{ fontWeight: '700' }}>Choisir une catégorie</Text>
            <Pressable
              onPress={() => { setIsOpen(false); setSearch(''); }}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.full }]}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Rechercher une catégorie..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          {/* "All categories" option */}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Pressable
              onPress={() => handleSelect(null)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: value === null ? `${colors.primary}10` : colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: value === null ? `${colors.primary}30` : colors.border,
                  marginBottom: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                },
                pressed && value !== null && { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Text
                variant="body"
                style={{ fontWeight: value === null ? '600' : '400', color: value === null ? colors.primary : colors.text, flex: 1 }}
              >
                Toutes les catégories
              </Text>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: value === null ? colors.primary : colors.border,
                    backgroundColor: value === null ? colors.primary : 'transparent',
                  },
                ]}
              >
                {value === null && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </Pressable>
          </View>

          {/* Options List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.id === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item.id)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: isSelected ? `${colors.primary}10` : colors.surface,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: isSelected ? `${colors.primary}30` : colors.border,
                      marginBottom: spacing.xs,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                    },
                    pressed && !isSelected && { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <Text
                    variant="body"
                    style={{ fontWeight: isSelected ? '600' : '400', color: isSelected ? colors.primary : colors.text, flex: 1 }}
                  >
                    {item.label}
                  </Text>
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Text variant="body" color="textMuted">Aucune catégorie trouvée</Text>
              </View>
            }
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
    minHeight: 36,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
