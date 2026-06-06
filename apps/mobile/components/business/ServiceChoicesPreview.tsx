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
import { View, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Input } from '../Input';

export interface PreviewService {
  name: string;
  price: number; // cents (base)
  duration: number; // minutes (base)
  photoURL?: string | null;
  variations: ServiceVariation[];
  options: ServiceOption[];
  infoFields: ServiceInfoField[];
}

export function ServiceChoicesPreview({
  service,
  mode = 'preview',
  onConfirm,
  confirmLabel = 'Ajouter',
  confirmLoading = false,
  safeAreaBottom = false,
}: {
  service: PreviewService;
  /** 'preview' = read-only illustration ; 'picker' = the bottom CTA confirms
   *  the current selections (used when adding a prestation to a booking). */
  mode?: 'preview' | 'picker';
  onConfirm?: (selections: ServiceSelections) => void;
  confirmLabel?: string;
  confirmLoading?: boolean;
  /** Add the device's bottom safe-area inset to the sticky bar. Set when the
   *  component sits flush against the screen bottom (full-screen step or
   *  custom overlay) rather than inside a SafeAreaView / pageSheet. */
  safeAreaBottom?: boolean;
}) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
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
      {f.type === 'text' &&
        (mode === 'picker' ? (
          <Input
            placeholder="Votre réponse…"
            value={value ?? ''}
            onChangeText={onSet}
            multiline
          />
        ) : (
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
        ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — photo + name + price / duration chips */}
        {!!service.photoURL && (
          <Image
            source={{ uri: service.photoURL }}
            style={{ width: '100%', height: 150, borderRadius: radius.lg }}
            resizeMode="cover"
          />
        )}

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">{service.name || 'Prestation'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.primaryLight || '#e4effa',
              }}
            >
              <Ionicons name="pricetag" size={13} color={colors.primary} />
              <Text variant="bodySmall" style={{ fontWeight: '700', color: colors.primary }}>
                {hasChoices
                  ? `À partir de ${formatPrice(getServiceMinPrice(service))}`
                  : formatPrice(service.price)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text variant="bodySmall" color="textSecondary" style={{ fontWeight: '600' }}>
                {formatDuration(getServiceMinDuration(service))}
              </Text>
            </View>
          </View>
        </View>

        {mode !== 'picker' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              Voici exactement ce que verra le client au moment de réserver.
            </Text>
          </View>
        )}

        {!hasChoices && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }}>
              Prestation à prix fixe — le client réserve directement, sans choix à faire.
              Ajoutez des variations ou options pour enrichir cette fiche.
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

      {/* Sticky total + faux "Réserver" (illustratif) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: safeAreaBottom ? insets.bottom + spacing.md : spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <View>
          <Text variant="caption" color="textSecondary">
            {complete ? 'Total' : 'À partir de'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            <Text variant="h3">{formatPrice(displayPrice)}</Text>
            <Text variant="caption" color="textMuted">
              · {formatDuration(displayDuration)}
            </Text>
          </View>
        </View>
        {mode === 'picker' ? (
          <Pressable
            onPress={() => complete && !confirmLoading && onConfirm?.(sel)}
            disabled={!complete || confirmLoading}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: 999,
              minWidth: 110,
              justifyContent: 'center',
              backgroundColor: complete ? colors.primary : colors.border,
              opacity: confirmLoading ? 0.7 : 1,
            }}
          >
            {confirmLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text variant="bodySmall" style={{ fontWeight: '700', color: '#FFFFFF' }}>
                  {confirmLabel}
                </Text>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: 999,
              backgroundColor: colors.primary,
            }}
          >
            <Text variant="bodySmall" style={{ fontWeight: '700', color: '#FFFFFF' }}>
              Réserver
            </Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </View>
        )}
      </View>
    </View>
  );
}
