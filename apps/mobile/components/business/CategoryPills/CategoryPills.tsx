/**
 * CategoryPills Component
 * Horizontal scrollable list of category pills
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';
import { CategoryPill } from './CategoryPill';

export interface Category {
  id: string;
  label: string;
}

export interface CategoryPillsProps {
  /** List of categories */
  categories: Category[];
  /** Currently selected category ID (null = all) */
  selectedId: string | null;
  /** Selection handler */
  onSelect: (id: string | null) => void;
  /** Show "All" pill at the beginning */
  showAll?: boolean;
  /** Label for "All" pill */
  allLabel?: string;
}

export function CategoryPills({
  categories,
  selectedId,
  onSelect,
  showAll = true,
  allLabel = 'Toutes',
}: CategoryPillsProps) {
  const { spacing } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: spacing.lg, gap: spacing.sm },
      ]}
    >
      {/* "All" pill */}
      {showAll && (
        <CategoryPill
          label={allLabel}
          selected={selectedId === null}
          onPress={() => onSelect(null)}
        />
      )}

      {/* Category pills */}
      {categories.map((category) => (
        <CategoryPill
          key={category.id}
          label={category.label}
          selected={selectedId === category.id}
          onPress={() => onSelect(category.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
