/**
 * OptionsEditor — RN editor for top-level service options (add-ons /
 * checkboxes). Each option carries an absolute price (€) and duration
 * (min) added when checked. Controlled component.
 *
 * Each option can ALSO carry nested variations and nested info fields
 * (mirrors the web editor) — only relevant once the client checks the
 * option. They're edited inline in a collapsible "Détails" sub-section.
 */

import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ServiceOption, newOption } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Input } from '../../Input';
import { VariationsEditor } from './VariationsEditor';
import { InfoFieldsEditor } from './InfoFieldsEditor';

export interface OptionsEditorProps {
  options: ServiceOption[];
  onChange: (next: ServiceOption[]) => void;
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const { colors, spacing, radius } = useTheme();
  // Which option cards have their nested "Détails" section open.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
      {options.map((option, oi) => {
        const nestedCount =
          (option.nestedVariations?.length ?? 0) + (option.nestedInfoFields?.length ?? 0);
        const isOpen = !!expanded[option.id];
        return (
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

            {/* Nested variations + infos for this option (collapsible). */}
            <Pressable
              onPress={() => setExpanded((p) => ({ ...p, [option.id]: !p[option.id] }))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingTop: spacing.xs,
              }}
            >
              <Ionicons
                name={isOpen ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.textSecondary}
              />
              <Text variant="caption" style={{ fontWeight: '600', color: colors.textSecondary }}>
                Détails de l'option
                {nestedCount > 0 ? ` (${nestedCount})` : ' — variations & infos'}
              </Text>
            </Pressable>

            {isOpen && (
              <View
                style={{
                  gap: spacing.md,
                  marginTop: spacing.xs,
                  paddingLeft: spacing.sm,
                  borderLeftWidth: 2,
                  borderLeftColor: colors.border,
                }}
              >
                <View style={{ gap: spacing.xs }}>
                  <Text variant="caption" color="textSecondary">
                    Variations de cette option (visibles si l'option est cochée)
                  </Text>
                  <VariationsEditor
                    variations={option.nestedVariations ?? []}
                    onChange={(n) => updateOption(oi, { nestedVariations: n })}
                  />
                </View>
                <View style={{ gap: spacing.xs }}>
                  <Text variant="caption" color="textSecondary">
                    Infos à demander pour cette option
                  </Text>
                  <InfoFieldsEditor
                    fields={option.nestedInfoFields ?? []}
                    onChange={(n) => updateOption(oi, { nestedInfoFields: n })}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}

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
