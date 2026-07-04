/**
 * InfoFieldsEditor — RN editor for service info fields (questions with
 * no price impact). Each field has a name, a type (text / boolean /
 * select) and an optional `required` flag. When type === 'select', the
 * field exposes an editable list of values. Controlled component.
 */

import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ServiceInfoField, newInfoField, moveItem } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Input } from '../../Input';
import { Switch } from '../../Switch';
import { animateChange } from './animateChange';

export interface InfoFieldsEditorProps {
  fields: ServiceInfoField[];
  onChange: (next: ServiceInfoField[]) => void;
}

const TYPE_OPTIONS: { type: ServiceInfoField['type']; label: string }[] = [
  { type: 'text', label: 'Texte libre' },
  { type: 'boolean', label: 'Oui/Non' },
  { type: 'select', label: 'Liste de choix' },
];

export function InfoFieldsEditor({ fields, onChange }: InfoFieldsEditorProps) {
  const { colors, spacing, radius } = useTheme();

  const updateField = (fi: number, patch: Partial<ServiceInfoField>) => {
    onChange(fields.map((f, i) => (i === fi ? { ...f, ...patch } : f)));
  };

  const removeField = (fi: number) => {
    animateChange();
    onChange(fields.filter((_, i) => i !== fi));
  };

  const addField = () => {
    animateChange();
    onChange([...fields, newInfoField()]);
  };

  const moveField = (fi: number, dir: -1 | 1) => {
    onChange(moveItem(fields, fi, dir));
  };

  const updateValue = (fi: number, vi: number, text: string) => {
    const values = [...(fields[fi].values ?? [])];
    values[vi] = text;
    updateField(fi, { values });
  };

  const removeValue = (fi: number, vi: number) => {
    updateField(fi, { values: (fields[fi].values ?? []).filter((_, i) => i !== vi) });
  };

  const addValue = (fi: number) => {
    updateField(fi, { values: [...(fields[fi].values ?? []), ''] });
  };

  return (
    <View style={{ gap: spacing.md }}>
      {fields.map((field, fi) => (
        <View
          key={field.id}
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
                label="Question"
                placeholder="Question (ex : Allergies ?)"
                value={field.name}
                onChangeText={(t) => updateField(fi, { name: t })}
                autoCapitalize="sentences"
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: 12 }}>
              <Pressable onPress={() => moveField(fi, -1)} hitSlop={6} disabled={fi === 0}>
                <Ionicons name="chevron-up" size={20} color={fi === 0 ? colors.disabled : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => moveField(fi, 1)} hitSlop={6} disabled={fi === fields.length - 1}>
                <Ionicons name="chevron-down" size={20} color={fi === fields.length - 1 ? colors.disabled : colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => removeField(fi)} hitSlop={6}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          </View>

          {/* Type selector */}
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {TYPE_OPTIONS.map((opt) => {
              const active = field.type === opt.type;
              return (
                <Pressable
                  key={opt.type}
                  onPress={() => updateField(fi, { type: opt.type })}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    alignItems: 'center',
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primaryLight : colors.surface,
                  }}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontWeight: active ? '700' : '500',
                      color: active ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Select values */}
          {field.type === 'select' && (
            <View style={{ gap: spacing.xs }}>
              {(field.values ?? []).map((value, vi) => (
                <View
                  key={vi}
                  style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}
                >
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder="Choix"
                      value={value}
                      onChangeText={(t) => updateValue(fi, vi, t)}
                      autoCapitalize="sentences"
                    />
                  </View>
                  <Pressable
                    onPress={() => removeValue(fi, vi)}
                    hitSlop={8}
                    style={{ paddingBottom: 12 }}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => addValue(fi)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
                  Ajouter un choix
                </Text>
              </Pressable>
            </View>
          )}

          <Switch
            label="Obligatoire"
            value={field.required}
            onValueChange={(v) => updateField(fi, { required: v })}
          />
        </View>
      ))}

      <Pressable
        onPress={addField}
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
          Ajouter une info
        </Text>
      </Pressable>
    </View>
  );
}
