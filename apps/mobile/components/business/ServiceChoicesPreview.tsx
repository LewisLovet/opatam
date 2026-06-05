/**
 * ServiceChoicesPreview — read-only-ish "client view" of a prestation.
 * Renders the variations / options / info fields the way a client sees
 * them in the booking flow, with a live total at the bottom, so the pro
 * understands the impact of their config while editing.
 *
 * Reuses the SHARED pricing helpers (computeServiceTotal, getServiceMin*,
 * validateServiceSelections) — no pricing logic lives here.
 */

import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type ServiceVariation,
  type ServiceOption,
  type ServiceInfoField,
  type ServiceSelections,
  emptyServiceSelections,
  computeServiceTotal,
  validateServiceSelections,
  getServiceMinPrice,
  getServiceMinDuration,
  formatPrice,
  formatDuration,
  serviceHasChoices,
} from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export interface PreviewService {
  name: string;
  price: number; // cents (base)
  duration: number; // minutes (base)
  variations: ServiceVariation[];
  options: ServiceOption[];
  infoFields: ServiceInfoField[];
}

export function ServiceChoicesPreview({ service }: { service: PreviewService }) {
  const { colors, spacing, radius } = useTheme();
  const [sel, setSel] = useState<ServiceSelections>(() => emptyServiceSelections());

  const hasChoices = serviceHasChoices(service);
  const total = computeServiceTotal(service, sel);
  const { missing } = validateServiceSelections(service, sel);
  const complete = missing.length === 0;

  // Before all required choices are made, show the reachable minimum
  // ("À partir de") rather than a misleading partial total.
  const displayPrice = complete ? total.price : getServiceMinPrice(service);
  const displayDuration = complete ? total.duration : getServiceMinDuration(service);

  // ── selection setters ─────────────────────────────────────────────
  const pickVariation = (variationId: string, optionId: string) =>
    setSel((p) => ({ ...p, variations: { ...p.variations, [variationId]: optionId } }));

  const toggleOption = (optionId: string) =>
    setSel((p) => {
      const next = { ...p.options };
      if (next[optionId]) delete next[optionId];
      else next[optionId] = { nestedVariations: {}, infoValues: {} };
      return { ...p, options: next };
    });

  const pickNestedVariation = (optionId: string, variationId: string, choiceId: string) =>
    setSel((p) => {
      const opt = p.options[optionId];
      if (!opt) return p;
      return {
        ...p,
        options: {
          ...p.options,
          [optionId]: {
            ...opt,
            nestedVariations: { ...opt.nestedVariations, [variationId]: choiceId },
          },
        },
      };
    });

  const setInfo = (fieldId: string, value: string) =>
    setSel((p) => ({ ...p, infoValues: { ...p.infoValues, [fieldId]: value } }));

  const setNestedInfo = (optionId: string, fieldId: string, value: string) =>
    setSel((p) => {
      const opt = p.options[optionId];
      if (!opt) return p;
      return {
        ...p,
        options: {
          ...p.options,
          [optionId]: { ...opt, infoValues: { ...opt.infoValues, [fieldId]: value } },
        },
      };
    });

  // ── small presentational helpers ──────────────────────────────────
  const Radio = ({ selected }: { selected: boolean }) => (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
      )}
    </View>
  );

  const Check = ({ selected }: { selected: boolean }) => (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
    </View>
  );

  const renderVariation = (
    v: ServiceVariation,
    chosenId: string | undefined,
    onPick: (optId: string) => void,
  ) => (
    <View key={v.id} style={{ gap: spacing.xs }}>
      <Text variant="bodySmall" style={{ fontWeight: '700', color: colors.text }}>
        {v.name || 'Variation'}
      </Text>
      <View style={{ gap: spacing.xs }}>
        {v.options.map((o) => {
          const selected = chosenId === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onPick(o.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primaryLight || '#e4effa' : colors.background,
              }}
            >
              <Radio selected={selected} />
              <Text variant="bodySmall" style={{ flex: 1, color: colors.text }}>
                {o.name || 'Choix'}
              </Text>
              <Text variant="caption" color="textSecondary">
                {formatPrice(o.price)}
                {o.duration ? ` · ${formatDuration(o.duration)}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderInfo = (
    f: ServiceInfoField,
    value: string | undefined,
    onSet: (v: string) => void,
  ) => (
    <View key={f.id} style={{ gap: spacing.xs }}>
      <Text variant="bodySmall" style={{ fontWeight: '700', color: colors.text }}>
        {f.name || 'Question'}
        {f.required ? <Text style={{ color: colors.error }}> *</Text> : null}
      </Text>
      {f.type === 'boolean' && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {['Oui', 'Non'].map((opt) => {
            const selected = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onSet(opt)}
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight || '#e4effa' : colors.background,
                }}
              >
                <Text variant="bodySmall" color={selected ? 'primary' : 'textSecondary'}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {f.type === 'select' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {(f.values ?? []).map((opt) => {
            const selected = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onSet(opt)}
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight || '#e4effa' : colors.background,
                }}
              >
                <Text variant="bodySmall" color={selected ? 'primary' : 'textSecondary'}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {f.type === 'text' && (
        <View
          style={{
            padding: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <Text variant="caption" color="textMuted">
            Réponse libre du client…
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
            Voici ce que verra le client au moment de réserver.
          </Text>
        </View>

        <Text variant="h3">{service.name || 'Prestation'}</Text>

        {!hasChoices && (
          <View style={{ gap: spacing.xs }}>
            <Text variant="body" color="textSecondary">
              Cette prestation n'a ni variation ni option : le client réserve
              directement au prix fixe.
            </Text>
          </View>
        )}

        {/* Top-level variations */}
        {service.variations.map((v) =>
          renderVariation(v, sel.variations[v.id], (optId) => pickVariation(v.id, optId)),
        )}

        {/* Top-level options */}
        {service.options.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text variant="bodySmall" style={{ fontWeight: '700', color: colors.text }}>
              Options
            </Text>
            {service.options.map((o) => {
              const checked = !!sel.options[o.id];
              return (
                <View key={o.id} style={{ gap: spacing.sm }}>
                  <Pressable
                    onPress={() => toggleOption(o.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: checked ? colors.primary : colors.border,
                      backgroundColor: checked ? colors.primaryLight || '#e4effa' : colors.background,
                    }}
                  >
                    <Check selected={checked} />
                    <Text variant="bodySmall" style={{ flex: 1, color: colors.text }}>
                      {o.name || 'Option'}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {o.price ? `+${formatPrice(o.price)}` : 'Inclus'}
                      {o.duration ? ` · +${formatDuration(o.duration)}` : ''}
                    </Text>
                  </Pressable>

                  {/* Nested choices revealed when the option is checked. */}
                  {checked && (o.nestedVariations.length > 0 || o.nestedInfoFields.length > 0) && (
                    <View
                      style={{
                        gap: spacing.md,
                        marginLeft: spacing.lg,
                        paddingLeft: spacing.sm,
                        borderLeftWidth: 2,
                        borderLeftColor: colors.border,
                      }}
                    >
                      {o.nestedVariations.map((nv) =>
                        renderVariation(
                          nv,
                          sel.options[o.id]?.nestedVariations[nv.id],
                          (choiceId) => pickNestedVariation(o.id, nv.id, choiceId),
                        ),
                      )}
                      {o.nestedInfoFields.map((nf) =>
                        renderInfo(nf, sel.options[o.id]?.infoValues[nf.id], (val) =>
                          setNestedInfo(o.id, nf.id, val),
                        ),
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Top-level info fields */}
        {service.infoFields.map((f) => renderInfo(f, sel.infoValues[f.id], (val) => setInfo(f.id, val)))}
      </ScrollView>

      {/* Sticky total */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <View>
          <Text variant="caption" color="textSecondary">
            {complete ? 'Total' : 'À partir de'}
          </Text>
          <Text variant="h3">{formatPrice(displayPrice)}</Text>
        </View>
        <Text variant="bodySmall" color="textSecondary">
          {formatDuration(displayDuration)}
        </Text>
      </View>
    </View>
  );
}
