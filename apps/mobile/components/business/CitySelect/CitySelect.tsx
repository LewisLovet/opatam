/**
 * CitySelect Component
 * Modern city picker with search and card-style items
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
  const { colors, spacing, radius } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSelect = (city: string | null) => {
    onChange(city);
    setIsOpen(false);
    setSearch('');
  };

  const sortedCities = useMemo(() =>
    [...cities].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    [cities]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedCities;
    const q = search.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return sortedCities.filter((c) =>
      c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    );
  }, [sortedCities, search]);

  const displayValue = value || placeholder;

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: value ? `${colors.primary}08` : colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: value ? `${colors.primary}30` : colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[styles.triggerIcon, { backgroundColor: value ? `${colors.primary}15` : colors.surfaceSecondary, borderRadius: radius.md }]}>
          <Ionicons
            name="location-outline"
            size={18}
            color={value ? colors.primary : colors.textMuted}
          />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          {value && (
            <Text variant="caption" color="textMuted" style={{ fontSize: 10, marginBottom: 1 }}>
              Ville
            </Text>
          )}
          <Text
            variant="body"
            color={value ? 'text' : 'textMuted'}
            style={{ fontWeight: value ? '600' : '400' }}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.textMuted}
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
            <Text variant="h3" style={{ fontWeight: '700' }}>Choisir une ville</Text>
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
                placeholder="Rechercher une ville..."
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

          {/* "All cities" option */}
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
                Toutes les villes
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
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item === value;
              return (
                <Pressable
                  onPress={() => handleSelect(item)}
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
                    {item}
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
                <Text variant="body" color="textMuted">Aucune ville trouvée</Text>
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
    minHeight: 52,
  },
  triggerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
