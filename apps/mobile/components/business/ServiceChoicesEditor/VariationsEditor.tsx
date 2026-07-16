/**
 * VariationsEditor — RN editor for service variations (groups of
 * mutually-exclusive choices, e.g. "Longueur" → "Mi-dos", "Long").
 * Each choice carries an ABSOLUTE price (€) and duration (min), i.e.
 * the total for that choice (not a supplement). Controlled component.
 */

import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import { animateChange } from './animateChange';

export interface VariationsEditorProps {
  variations: ServiceVariation[];
  onChange: (next: ServiceVariation[]) => void;
}

export function VariationsEditor({ variations, onChange }: VariationsEditorProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const updateVariation = (vi: number, patch: Partial<ServiceVariation>) => {
    onChange(variations.map((v, i) => (i === vi ? { ...v, ...patch } : v)));
  };

  const removeVariation = (vi: number) => {
    animateChange();
    onChange(variations.filter((_, i) => i !== vi));
  };

  const addVariation = () => {
    animateChange();
    onChange([...variations, newVariation()]);
  };

  const moveVariation = (vi: number, dir: -1 | 1) => {
    onChange(moveItem(variations, vi, dir));
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
    animateChange();
    updateVariation(vi, {
      options: variations[vi].options.filter((_, i) => i !== oi),
    });
  };

  const addOption = (vi: number) => {
    animateChange();
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
                label={t('proServices.editor.variationNameLabel')}
                placeholder={t('proServices.editor.variationNamePlaceholder')}
                value={variation.name}
                onChangeText={(t) => updateVariation(vi, { name: t })}
                autoCapitalize="sentences"
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: 12 }}>
              <Pressable onPress={() => moveVariation(vi, -1)} hitSlop={6} disabled={vi === 0}>
                <Ionicons name="chevron-up" size={20} color={vi === 0 ? colors.disabled : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => moveVariation(vi, 1)} hitSlop={6} disabled={vi === variations.length - 1}>
                <Ionicons name="chevron-down" size={20} color={vi === variations.length - 1 ? colors.disabled : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => removeVariation(vi)} hitSlop={6}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
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
                placeholder={t('proServices.editor.choicePlaceholder')}
                value={option.name}
                onChangeText={(t) => updateOption(vi, oi, { name: t })}
                autoCapitalize="sentences"
              />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                <View style={{ width: 90 }}>
                  <Input
                    label={t('proServices.editor.priceLabel')}
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
                    label={t('proServices.editor.durationLabel')}
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
              {t('proServices.editor.addChoice')}
            </Text>
          </Pressable>
        </View>
      ))}

      <Text variant="caption" color="textSecondary">
        {t('proServices.editor.totalPriceNote')}
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
          {t('proServices.editor.addVariation')}
        </Text>
      </Pressable>
    </View>
  );
}
