/**
 * ServicePickerModal — bottom-sheet to pick a prestation for the month
 * availability views (pro agenda + story). Lists prestations grouped by
 * category, and — when a prestation has variations/options — a 2nd step to
 * pick them so the availability uses the right effective duration
 * (durationOverride).
 */

import React, { useState, useEffect } from 'react';
import { View, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeServiceTotal, emptyServiceSelections } from '@booking-app/shared';
import type { Service, ServiceSelections } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

interface ServicePickerModalProps {
  visible: boolean;
  onClose: () => void;
  services: WithId<Service>[];
  categories: { id: string; name: string }[];
  currentServiceId: string | null;
  onApply: (
    serviceId: string | null,
    durationOverride: number | undefined,
    label: string,
  ) => void;
}

export function ServicePickerModal({
  visible,
  onClose,
  services,
  categories,
  currentServiceId,
  onApply,
}: ServicePickerModalProps) {
  const { colors, spacing, radius } = useTheme();
  const [detail, setDetail] = useState<WithId<Service> | null>(null);
  const [selections, setSelections] = useState<ServiceSelections>(emptyServiceSelections());

  useEffect(() => {
    if (visible) setDetail(null);
  }, [visible]);

  const hasChoices = (svc: WithId<Service>) =>
    (svc.variations?.length ?? 0) > 0 || (svc.options?.length ?? 0) > 0;

  const openDetail = (svc: WithId<Service>) => {
    const init = emptyServiceSelections();
    for (const v of svc.variations ?? []) {
      if (v.options?.length) init.variations[v.id] = v.options[0].id;
    }
    setSelections(init);
    setDetail(svc);
  };

  const pickService = (svc: WithId<Service>) => {
    if (hasChoices(svc)) openDetail(svc);
    else onApply(svc.id, undefined, svc.name);
  };

  const setVariation = (variationId: string, optionId: string) =>
    setSelections((prev) => ({
      ...prev,
      variations: { ...prev.variations, [variationId]: optionId },
    }));

  const toggleOption = (optionId: string) =>
    setSelections((prev) => {
      const options = { ...prev.options };
      if (options[optionId]) delete options[optionId];
      else options[optionId] = { nestedVariations: {}, infoValues: {} };
      return { ...prev, options };
    });

  const applyDetail = () => {
    if (!detail) return;
    const { duration } = computeServiceTotal(detail, selections);
    const dur = duration + (detail.bufferTime || 0);
    onApply(detail.id, dur > 0 ? dur : undefined, detail.name);
  };

  // Group prestations by category for easier navigation when there are many.
  const grouped = (() => {
    const map = new Map<string, { id: string; name: string; services: WithId<Service>[] }>();
    const order: string[] = [];
    for (const svc of services) {
      const catId = svc.categoryId ?? '__none__';
      if (!map.has(catId)) {
        map.set(catId, {
          id: catId,
          name:
            catId === '__none__'
              ? 'Autres'
              : categories.find((c) => c.id === catId)?.name ?? 'Autres',
          services: [],
        });
        order.push(catId);
      }
      map.get(catId)!.services.push(svc);
    }
    return order.map((id) => map.get(id)!);
  })();
  const showHeaders =
    grouped.length > 1 || (grouped.length === 1 && grouped[0].id !== '__none__');

  const rowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing['2xl'],
            maxHeight: '82%',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />

          {detail ? (
            <>
              <Pressable
                onPress={() => setDetail(null)}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
                <Text variant="body" color="primary">
                  Retour
                </Text>
              </Pressable>
              <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                {detail.name}
              </Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {(detail.variations ?? []).map((v) => (
                  <View key={v.id} style={{ marginBottom: spacing.md }}>
                    <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                      {v.name}
                    </Text>
                    {v.options.map((o) => {
                      const active = selections.variations[v.id] === o.id;
                      return (
                        <Pressable key={o.id} onPress={() => setVariation(v.id, o.id)} style={rowStyle}>
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={active ? colors.primary : colors.textSecondary}
                          />
                          <Text variant="body" style={{ flex: 1, marginLeft: spacing.sm }}>
                            {o.name}
                          </Text>
                          <Text variant="caption" color="textSecondary">
                            {o.duration} min
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
                {(detail.options ?? []).length > 0 && (
                  <Text
                    variant="label"
                    color="textSecondary"
                    style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}
                  >
                    Options
                  </Text>
                )}
                {(detail.options ?? []).map((opt) => {
                  const checked = !!selections.options[opt.id];
                  return (
                    <Pressable key={opt.id} onPress={() => toggleOption(opt.id)} style={rowStyle}>
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={checked ? colors.primary : colors.textSecondary}
                      />
                      <Text variant="body" style={{ flex: 1, marginLeft: spacing.sm }}>
                        {opt.name}
                      </Text>
                      <Text variant="caption" color="textSecondary">
                        +{opt.duration} min
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={applyDetail}
                style={{
                  marginTop: spacing.md,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: 'center',
                }}
              >
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Appliquer
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text variant="h3" style={{ marginBottom: spacing.md }}>
                Choisir une prestation
              </Text>
              <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                {/* Vue générale — carte mise en avant */}
                <Pressable
                  onPress={() => onApply(null, undefined, 'Vue générale')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    borderWidth: 1.5,
                    borderColor: currentServiceId === null ? colors.primary : colors.border,
                    backgroundColor: currentServiceId === null ? colors.primaryLight : colors.surface,
                    marginBottom: spacing.lg,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.primaryLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="apps-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontWeight: '600' }}>
                      Vue générale
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      Occupation, toutes prestations confondues
                    </Text>
                  </View>
                  {currentServiceId === null && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>

                {/* Prestations groupées par catégorie */}
                {grouped.map((group) => (
                  <View key={group.id} style={{ marginBottom: spacing.lg }}>
                    {showHeaders && (
                      <Text
                        variant="label"
                        color="textSecondary"
                        style={{ marginBottom: spacing.xs, marginLeft: spacing.xs, textTransform: 'uppercase' }}
                      >
                        {group.name}
                      </Text>
                    )}
                    <View
                      style={{
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: 'hidden',
                      }}
                    >
                      {group.services.map((svc, idx) => {
                        const selected = currentServiceId === svc.id;
                        return (
                          <Pressable
                            key={svc.id}
                            onPress={() => pickService(svc)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: spacing.md,
                              backgroundColor: selected ? colors.primaryLight : colors.surface,
                              borderTopWidth: idx === 0 ? 0 : 1,
                              borderTopColor: colors.divider,
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text variant="body" style={selected ? { fontWeight: '600' } : undefined}>
                                {svc.name}
                              </Text>
                              {hasChoices(svc) && (
                                <Text variant="caption" color="textSecondary">
                                  Variations / options
                                </Text>
                              )}
                            </View>
                            {hasChoices(svc) ? (
                              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                            ) : selected ? (
                              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
});
