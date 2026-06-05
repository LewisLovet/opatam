/**
 * OptionsEditor — RN editor for top-level service options (add-ons /
 * checkboxes). Each option carries an absolute price (€) and duration
 * (min) added when checked. Controlled component.
 *
 * Nested variations / info fields inside an option are NOT edited here
 * yet — they keep their defaults ([]). // TODO: nested editing
 */

import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ServiceOption, newOption } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Input } from '../../Input';

export interface OptionsEditorProps {
  options: ServiceOption[];
  onChange: (next: ServiceOption[]) => void;
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const { colors, spacing, radius } = useTheme();

  const updateOption = (oi: number, patch: Partial<ServiceOption>) => {
    onChange(options.map((o, i) => (i === oi ? { ...o, ...patch } : o)));
  };

  const removeOption = (oi: number) => {
    onChange(options.filter((_, i) => i !== oi));
  };

  const addOption = () => {
    onChange([...options, newOption()]);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {options.map((option, oi) => (
        <View
          key={option.id}
          style={{
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Nom de l'option"
                placeholder="Nom de l'option (ex : Mèches)"
                value={option.name}
                onChangeText={(t) => updateOption(oi, { name: t })}
                autoCapitalize="sentences"
              />
            </View>
            <Pressable
              onPress={() => removeOption(oi)}
              hitSlop={8}
              style={{ paddingBottom: 12 }}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ width: 90 }}>
              <Input
                label="Prix (€)"
                placeholder="0"
                keyboardType="numeric"
                value={option.price ? String(option.price / 100) : ''}
                onChangeText={(t) =>
                  updateOption(oi, { price: Math.round((parseFloat(t) || 0) * 100) })
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
                  updateOption(oi, {
                    duration: Math.max(0, Math.round(parseFloat(t) || 0)),
                  })
                }
              />
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={addOption}
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
          Ajouter une option
        </Text>
      </Pressable>
    </View>
  );
}
