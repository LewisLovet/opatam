/**
 * VariationsEditor — RN editor for service variations (groups of
 * mutually-exclusive choices, e.g. "Longueur" → "Mi-dos", "Long").
 * Each choice carries an ABSOLUTE price (€) and duration (min), i.e.
 * the total for that choice (not a supplement). Controlled component.
 */

import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type ServiceVariation,
  type ServiceVariationOption,
  newVariation,
  newVariationOption,
  moveItem,
} from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Input } from '../../Input';

export interface VariationsEditorProps {
  variations: ServiceVariation[];
  onChange: (next: ServiceVariation[]) => void;
}

export function VariationsEditor({ variations, onChange }: VariationsEditorProps) {
  const { colors, spacing, radius } = useTheme();

  const updateVariation = (vi: number, patch: Partial<ServiceVariation>) => {
    onChange(variations.map((v, i) => (i === vi ? { ...v, ...patch } : v)));
  };

  const removeVariation = (vi: number) => {
    onChange(variations.filter((_, i) => i !== vi));
  };

  const addVariation = () => {
    onChange([...variations, newVariation()]);
  };

  const updateOption = (
    vi: number,
    oi: number,
    patch: Partial<ServiceVariationOption>,
  ) => {
    updateVariation(vi, {
      options: variations[vi].options.map((o, i) =>
        i === oi ? { ...o, ...patch } : o,
      ),
    });
  };

  const removeOption = (vi: number, oi: number) => {
    updateVariation(vi, {
      options: variations[vi].options.filter((_, i) => i !== oi),
    });
  };

  const addOption = (vi: number) => {
    updateVariation(vi, { options: [...variations[vi].options, newVariationOption()] });
  };

  const moveOption = (vi: number, oi: number, dir: -1 | 1) => {
    updateVariation(vi, { options: moveItem(variations[vi].options, oi, dir) });
  };

  return (
    <View style={{ gap: spacing.md }}>
      {variations.map((variation, vi) => (
        <View
          key={variation.id}
          style={{
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          {/* Variation header: name + delete */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Nom de la variation"
                placeholder="Nom de la variation (ex : Longueur)"
                value={variation.name}
                onChangeText={(t) => updateVariation(vi, { name: t })}
                autoCapitalize="sentences"
              />
            </View>
            <Pressable
              onPress={() => removeVariation(vi)}
              hitSlop={8}
              style={{ paddingBottom: 12 }}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </Pressable>
          </View>

          {/* Choices */}
          {variation.options.map((option, oi) => (
            <View
              key={option.id}
              style={{
                gap: spacing.xs,
                padding: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Input
                placeholder="Choix (ex : Mi-dos)"
                value={option.name}
                onChangeText={(t) => updateOption(vi, oi, { name: t })}
                autoCapitalize="sentences"
              />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                <View style={{ width: 90 }}>
                  <Input
                    label="Prix (€)"
                    placeholder="0"
                    keyboardType="numeric"
                    value={option.price ? String(option.price / 100) : ''}
                    onChangeText={(t) =>
                      updateOption(vi, oi, {
                        price: Math.round((parseFloat(t) || 0) * 100),
                      })
                    }
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Input
                    label="Durée (min)"
                    placeholder="0"
                    keyboardType="numeric"
                    value={option.duration ? String(option.duration) : ''}
                    onChangeText={(t) =>
                      updateOption(vi, oi, {
                        duration: Math.max(0, Math.round(parseFloat(t) || 0)),
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.xs, paddingBottom: 12 }}>
                  <Pressable onPress={() => moveOption(vi, oi, -1)} hitSlop={6} disabled={oi === 0}>
                    <Ionicons
                      name="chevron-up"
                      size={22}
                      color={oi === 0 ? colors.disabled : colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => moveOption(vi, oi, 1)}
                    hitSlop={6}
                    disabled={oi === variation.options.length - 1}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={22}
                      color={oi === variation.options.length - 1 ? colors.disabled : colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable onPress={() => removeOption(vi, oi)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => addOption(vi)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
              Ajouter un choix
            </Text>
          </Pressable>
        </View>
      ))}

      <Text variant="caption" color="textSecondary">
        Prix et durée = le total pour ce choix (pas un supplément).
      </Text>

      <Pressable
        onPress={addVariation}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
        }}
      >
        <Ionicons name="add" size={18} color={colors.textSecondary} />
        <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.textSecondary }}>
          Ajouter une variation
        </Text>
      </Pressable>
    </View>
  );
}
