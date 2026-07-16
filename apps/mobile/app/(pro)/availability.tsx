/**
 * Availability Management Screen
 * Weekly schedule editor per member. Each day shows a toggle (open/closed)
 * and time slots. Supports multiple slots per day, copy-to-other-days,
 * and member selector if multiple members exist.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../lib/i18n';
import { useTheme } from '../../theme';
import { Text, Button, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import {
  schedulingService,
  memberService,
  type WithId,
} from '@booking-app/firebase';
import type { Availability, TimeSlot, Member } from '@booking-app/shared/types';
import { MEMBER_COLORS } from '@booking-app/shared/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Noms de jours localisés via Intl sur la langue de l'app (plus de tableaux FR
// en dur). Référence : 2023-01-01 (UTC) est un dimanche → dow 0.
const REF_SUNDAY_UTC = Date.UTC(2023, 0, 1);
function dayName(dow: number, format: 'long' | 'short'): string {
  const label = new Intl.DateTimeFormat(i18n.language, { weekday: format, timeZone: 'UTC' })
    .format(new Date(REF_SUNDAY_UTC + dow * 86400000));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Ordered Mon→Sun
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

const DEFAULT_SLOT: TimeSlot = { start: '09:00', end: '18:00' };

// Schedule templates — label/description résolus via i18n (proAvailability.templates.<id>)
interface ScheduleTemplate {
  id: 'standard' | 'split' | 'extended' | 'weekend';
  icon: string;
  days: { dayOfWeek: number; isOpen: boolean; slots: TimeSlot[] }[];
}

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'standard',
    icon: 'sunny-outline',
    days: ORDERED_DAYS.map((dow) => ({
      dayOfWeek: dow,
      isOpen: dow >= 1 && dow <= 5,
      slots: [{ start: '09:00', end: '18:00' }],
    })),
  },
  {
    id: 'split',
    icon: 'restaurant-outline',
    days: ORDERED_DAYS.map((dow) => ({
      dayOfWeek: dow,
      isOpen: dow >= 1 && dow <= 5,
      slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    })),
  },
  {
    id: 'extended',
    icon: 'moon-outline',
    days: ORDERED_DAYS.map((dow) => ({
      dayOfWeek: dow,
      isOpen: dow >= 1 && dow <= 6,
      slots: [{ start: '08:00', end: '20:00' }],
    })),
  },
  {
    id: 'weekend',
    icon: 'calendar-outline',
    days: ORDERED_DAYS.map((dow) => ({
      dayOfWeek: dow,
      isOpen: dow >= 1 && dow <= 6,
      slots: dow === 6 ? [{ start: '09:00', end: '13:00' }] : [{ start: '09:00', end: '18:00' }],
    })),
  },
];

// Time options (15-min increments)
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return opts;
})();

// "HH:MM" → minutes. Une fin à "00:00" = minuit = fin de journée (1440), pas 0
// (sans ça, une plage 19:00→00:00 serait jugée invalide et non réservable).
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const endToMinutes = (t: string) => (t === '00:00' ? 24 * 60 : toMinutes(t));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function AvailabilityScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { providerId } = useProvider();

  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [originalSchedule, setOriginalSchedule] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState<{
    dayIndex: number;
    slotIndex: number;
    field: 'start' | 'end';
  } | null>(null);
  const [showCopyModal, setShowCopyModal] = useState<number | null>(null); // dayOfWeek
  const [copyTargets, setCopyTargets] = useState<number[]>([]);

  // Load members
  const loadMembers = useCallback(async () => {
    if (!providerId) return;
    try {
      const list = await memberService.getActiveByProvider(providerId);
      setMembers(list);
      if (list.length > 0 && !selectedMemberId) {
        setSelectedMemberId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading members:', err);
    }
  }, [providerId, selectedMemberId]);

  // Load schedule for selected member
  const loadSchedule = useCallback(async () => {
    if (!providerId || !selectedMemberId) return;
    try {
      const availabilities = await schedulingService.getWeeklySchedule(providerId, selectedMemberId);

      // Build schedule for all 7 days
      const weekSchedule: DaySchedule[] = ORDERED_DAYS.map((dow) => {
        const existing = availabilities.find((a) => a.dayOfWeek === dow);
        if (existing) {
          return {
            dayOfWeek: dow,
            isOpen: existing.isOpen,
            slots: existing.slots.length > 0 ? [...existing.slots] : [{ ...DEFAULT_SLOT }],
          };
        }
        return {
          dayOfWeek: dow,
          isOpen: false,
          slots: [{ ...DEFAULT_SLOT }],
        };
      });

      setSchedule(weekSchedule);
      setOriginalSchedule(JSON.parse(JSON.stringify(weekSchedule)));
    } catch (err) {
      console.error('Error loading schedule:', err);
      showToast({ variant: 'error', message: i18n.t('proAvailability.loadError') });
    }
  }, [providerId, selectedMemberId, showToast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (selectedMemberId) {
      setLoading(true);
      loadSchedule().finally(() => setLoading(false));
    }
  }, [selectedMemberId, loadSchedule]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSchedule();
    setRefreshing(false);
  }, [loadSchedule]);

  // Check if schedule has changed
  const isDirty = JSON.stringify(schedule) !== JSON.stringify(originalSchedule);

  // Toggle day open/closed
  const toggleDay = (dayIndex: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const day = { ...updated[dayIndex] };
      day.isOpen = !day.isOpen;
      if (day.isOpen && day.slots.length === 0) {
        day.slots = [{ ...DEFAULT_SLOT }];
      }
      updated[dayIndex] = day;
      return updated;
    });
  };

  // Update a time slot
  const updateSlot = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const day = { ...updated[dayIndex] };
      const slots = [...day.slots];
      slots[slotIndex] = { ...slots[slotIndex], [field]: value };
      day.slots = slots;
      updated[dayIndex] = day;
      return updated;
    });
  };

  // Add a slot to a day
  const addSlot = (dayIndex: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const day = { ...updated[dayIndex] };
      if (day.slots.length >= 4) return prev;
      const lastEnd = day.slots[day.slots.length - 1]?.end || '18:00';
      day.slots = [...day.slots, { start: lastEnd, end: '20:00' }];
      updated[dayIndex] = day;
      return updated;
    });
  };

  // Remove a slot from a day
  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setSchedule((prev) => {
      const updated = [...prev];
      const day = { ...updated[dayIndex] };
      if (day.slots.length <= 1) return prev;
      day.slots = day.slots.filter((_, i) => i !== slotIndex);
      updated[dayIndex] = day;
      return updated;
    });
  };

  // Copy schedule to other days
  const handleCopyTo = () => {
    if (showCopyModal === null || copyTargets.length === 0) return;
    const sourceDay = schedule.find((d) => d.dayOfWeek === showCopyModal);
    if (!sourceDay) return;

    setSchedule((prev) =>
      prev.map((day) => {
        if (copyTargets.includes(day.dayOfWeek)) {
          return {
            ...day,
            isOpen: sourceDay.isOpen,
            slots: JSON.parse(JSON.stringify(sourceDay.slots)),
          };
        }
        return day;
      })
    );

    setShowCopyModal(null);
    setCopyTargets([]);
    showToast({ variant: 'success', message: t('proAvailability.copied') });
  };

  // Save schedule
  const handleSave = async () => {
    if (!providerId || !selectedMemberId) return;

    // Validate slots
    for (const day of schedule) {
      if (day.isOpen) {
        for (const slot of day.slots) {
          if (slot.start === slot.end || toMinutes(slot.start) >= endToMinutes(slot.end)) {
            showToast({
              variant: 'error',
              message: t('proAvailability.validation.endAfterStart', { day: dayName(day.dayOfWeek, 'long') }),
            });
            return;
          }
        }
      }
    }

    const member = members.find((m) => m.id === selectedMemberId);
    if (!member?.locationId) {
      showToast({ variant: 'error', message: t('proAvailability.validation.noLocation') });
      return;
    }

    setSaving(true);
    try {
      await schedulingService.setWeeklySchedule(
        providerId,
        selectedMemberId,
        member.locationId,
        schedule.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          slots: day.isOpen ? day.slots : [],
          isOpen: day.isOpen,
        }))
      );
      setOriginalSchedule(JSON.parse(JSON.stringify(schedule)));
      showToast({ variant: 'success', message: t('proAvailability.saved') });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || t('proAvailability.saveError') });
    } finally {
      setSaving(false);
    }
  };

  // Apply a template
  const applyTemplate = (template: ScheduleTemplate) => {
    const label = t(`proAvailability.templates.${template.id}.label`);
    if (isDirty) {
      Alert.alert(
        t('proAvailability.applyTemplate.title'),
        t('proAvailability.applyTemplate.message', { label }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('proAvailability.applyTemplate.apply'),
            onPress: () => {
              setSchedule(
                template.days.map((d) => ({
                  dayOfWeek: d.dayOfWeek,
                  isOpen: d.isOpen,
                  slots: JSON.parse(JSON.stringify(d.slots)),
                }))
              );
              showToast({ variant: 'success', message: t('proAvailability.applyTemplate.applied', { label }) });
            },
          },
        ]
      );
    } else {
      setSchedule(
        template.days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isOpen: d.isOpen,
          slots: JSON.parse(JSON.stringify(d.slots)),
        }))
      );
      showToast({ variant: 'success', message: t('proAvailability.applyTemplate.applied', { label }) });
    }
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              if (isDirty) {
                Alert.alert(
                  t('proAvailability.unsaved.title'),
                  t('proAvailability.unsaved.leaveMessage'),
                  [
                    { text: t('proAvailability.unsaved.stay'), style: 'cancel' },
                    { text: t('proAvailability.unsaved.leave'), style: 'destructive', onPress: () => router.back() },
                  ]
                );
              } else {
                router.back();
              }
            }}
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text variant="h3" style={{ color: '#FFFFFF', flex: 1, marginLeft: spacing.sm }}>
            {t('proAvailability.title')}
          </Text>
          {isDirty && (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {t('common.save')}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : members.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.md }}>
            {t('proAvailability.emptyMembers')}
          </Text>
        </View>
      ) : (
        <>
          {/* Member selector (if multiple) */}
          {members.length > 1 && (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {members.map((member) => {
                    const isSelected = member.id === selectedMemberId;
                    const memberColor = member.color || MEMBER_COLORS[0];
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          if (isDirty) {
                            Alert.alert(
                              t('proAvailability.unsaved.title'),
                              t('proAvailability.unsaved.switchMessage'),
                              [
                                { text: t('common.cancel'), style: 'cancel' },
                                {
                                  text: t('proAvailability.unsaved.switchConfirm'),
                                  style: 'destructive',
                                  onPress: () => setSelectedMemberId(member.id),
                                },
                              ]
                            );
                          } else {
                            setSelectedMemberId(member.id);
                          }
                        }}
                        style={[
                          styles.memberPill,
                          {
                            backgroundColor: isSelected ? memberColor : colors.surfaceSecondary,
                            borderRadius: radius.full,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.memberDot,
                            { backgroundColor: isSelected ? '#FFFFFF' : memberColor },
                          ]}
                        />
                        <Text
                          variant="caption"
                          style={{
                            color: isSelected ? '#FFFFFF' : colors.text,
                            fontWeight: isSelected ? '600' : '400',
                          }}
                        >
                          {member.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Single member info */}
          {members.length === 1 && selectedMember && (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <View
                  style={[
                    styles.memberDot,
                    { backgroundColor: selectedMember.color || MEMBER_COLORS[0] },
                  ]}
                />
                <Text variant="body" style={{ fontWeight: '500' }}>
                  {selectedMember.name}
                </Text>
              </View>
            </View>
          )}

          {/* Schedule editor */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
          >
            {/* Templates */}
            <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('proAvailability.templatesTitle')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.lg }}
            >
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {SCHEDULE_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.id}
                    onPress={() => applyTemplate(template)}
                    style={({ pressed }) => [
                      styles.templateCard,
                      {
                        backgroundColor: pressed ? colors.primaryLight || '#e4effa' : colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <View style={[styles.templateIcon, { backgroundColor: colors.primaryLight || '#e4effa', borderRadius: radius.sm }]}>
                      <Ionicons name={template.icon as any} size={20} color={colors.primary} />
                    </View>
                    <Text variant="caption" style={{ fontWeight: '600', marginTop: spacing.xs }}>
                      {t(`proAvailability.templates.${template.id}.label`)}
                    </Text>
                    <Text variant="caption" color="textMuted" style={{ fontSize: 11, marginTop: 2 }}>
                      {t(`proAvailability.templates.${template.id}.description`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Card padding="none" shadow="sm">
              {schedule.map((day, dayIndex) => {
                const isLast = dayIndex === schedule.length - 1;
                return (
                  <React.Fragment key={day.dayOfWeek}>
                    <View style={styles.dayRow}>
                      {/* Toggle + Day name */}
                      <View style={styles.dayHeader}>
                        <Switch
                          value={day.isOpen}
                          onValueChange={() => toggleDay(dayIndex)}
                          trackColor={{ false: colors.border, true: colors.primary }}
                          thumbColor="#FFFFFF"
                          style={{ transform: [{ scale: 0.8 }] }}
                        />
                        <Text
                          variant="caption"
                          style={{
                            fontWeight: '600',
                            fontSize: 13,
                            color: day.isOpen ? colors.text : colors.textMuted,
                            width: 40,
                          }}
                        >
                          {dayName(day.dayOfWeek, 'short')}
                        </Text>
                      </View>

                      {/* Slots or Fermé */}
                      <View style={styles.slotsContainer}>
                        {day.isOpen ? (
                          <>
                            {day.slots.map((slot, slotIndex) => {
                              const hasError = slot.start === slot.end || toMinutes(slot.start) >= endToMinutes(slot.end);
                              return (
                                <View key={slotIndex} style={styles.slotRow}>
                                  <Pressable
                                    onPress={() =>
                                      setShowTimePicker({ dayIndex, slotIndex, field: 'start' })
                                    }
                                    style={[
                                      styles.timeButton,
                                      {
                                        backgroundColor: colors.surfaceSecondary,
                                        borderRadius: radius.sm,
                                        borderColor: hasError ? '#DC2626' : 'transparent',
                                        borderWidth: hasError ? 1 : 0,
                                      },
                                    ]}
                                  >
                                    <Text variant="caption" style={{ fontWeight: '500' }}>
                                      {slot.start}
                                    </Text>
                                  </Pressable>
                                  <Text variant="caption" color="textMuted">–</Text>
                                  <Pressable
                                    onPress={() =>
                                      setShowTimePicker({ dayIndex, slotIndex, field: 'end' })
                                    }
                                    style={[
                                      styles.timeButton,
                                      {
                                        backgroundColor: colors.surfaceSecondary,
                                        borderRadius: radius.sm,
                                        borderColor: hasError ? '#DC2626' : 'transparent',
                                        borderWidth: hasError ? 1 : 0,
                                      },
                                    ]}
                                  >
                                    <Text variant="caption" style={{ fontWeight: '500' }}>
                                      {slot.end}
                                    </Text>
                                  </Pressable>
                                  {day.slots.length > 1 && (
                                    <Pressable
                                      onPress={() => removeSlot(dayIndex, slotIndex)}
                                      hitSlop={8}
                                    >
                                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                                    </Pressable>
                                  )}
                                </View>
                              );
                            })}
                            {day.slots.length < 4 && (
                              <Pressable
                                onPress={() => addSlot(dayIndex)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                              >
                                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                                <Text variant="caption" style={{ color: colors.primary }}>
                                  {t('proAvailability.addSlot')}
                                </Text>
                              </Pressable>
                            )}
                          </>
                        ) : (
                          <Text variant="caption" color="textMuted">{t('proAvailability.closed')}</Text>
                        )}
                      </View>

                      {/* Copy button */}
                      {day.isOpen && (
                        <Pressable
                          onPress={() => {
                            setShowCopyModal(day.dayOfWeek);
                            setCopyTargets([]);
                          }}
                          hitSlop={8}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                    {!isLast && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  </React.Fragment>
                );
              })}
            </Card>

            {/* Info box */}
            <View
              style={[
                styles.infoBox,
                { backgroundColor: '#EFF6FF', borderRadius: radius.md, marginTop: spacing.lg },
              ]}
            >
              <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
              <Text variant="caption" style={{ color: '#1D4ED8', flex: 1 }}>
                {t('proAvailability.infoBox')}
              </Text>
            </View>

            {/* Save button (sticky at bottom for mobile UX) */}
            {isDirty && (
              <View style={{ marginTop: spacing.lg }}>
                <Button
                  title={t('proAvailability.saveChanges')}
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker !== null} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTimePicker(null)}
        >
          <Pressable
            style={[styles.pickerModal, { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerHandle}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
            </View>
            <Text variant="h3" align="center" style={{ marginBottom: spacing.md }}>
              {showTimePicker?.field === 'start' ? t('proAvailability.startTime') : t('proAvailability.endTime')}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {TIME_OPTIONS.map((time) => {
                const isSelected =
                  showTimePicker &&
                  schedule[showTimePicker.dayIndex]?.slots[showTimePicker.slotIndex]?.[
                    showTimePicker.field
                  ] === time;
                return (
                  <Pressable
                    key={time}
                    onPress={() => {
                      if (showTimePicker) {
                        updateSlot(
                          showTimePicker.dayIndex,
                          showTimePicker.slotIndex,
                          showTimePicker.field,
                          time
                        );
                        setShowTimePicker(null);
                      }
                    }}
                    style={[
                      styles.timeOption,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text
                      variant="body"
                      style={{
                        color: isSelected ? '#FFFFFF' : colors.text,
                        fontWeight: isSelected ? '600' : '400',
                        textAlign: 'center',
                      }}
                    >
                      {time}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Copy-to Modal */}
      <Modal visible={showCopyModal !== null} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCopyModal(null)}
        >
          <Pressable
            style={[styles.copyModal, { backgroundColor: colors.background, borderRadius: radius.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="h3" style={{ marginBottom: spacing.sm }}>
              {t('proAvailability.copy.title')}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.md }}>
              {t('proAvailability.copy.message', { day: showCopyModal !== null ? dayName(showCopyModal, 'long') : '' })}
            </Text>

            {ORDERED_DAYS.filter((d) => d !== showCopyModal).map((dow) => {
              const isChecked = copyTargets.includes(dow);
              return (
                <Pressable
                  key={dow}
                  onPress={() => {
                    setCopyTargets((prev) =>
                      isChecked ? prev.filter((d) => d !== dow) : [...prev, dow]
                    );
                  }}
                  style={[styles.copyOption, { borderColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isChecked ? colors.primary : 'transparent',
                        borderColor: isChecked ? colors.primary : colors.border,
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    {isChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text variant="body">{dayName(dow, 'long')}</Text>
                </Pressable>
              );
            })}

            <View style={[styles.copyActions, { marginTop: spacing.md }]}>
              <Pressable
                onPress={() => setShowCopyModal(null)}
                style={[styles.copyCancel, { borderColor: colors.border, borderRadius: radius.md }]}
              >
                <Text variant="body" style={{ fontWeight: '500' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleCopyTo}
                disabled={copyTargets.length === 0}
                style={[
                  styles.copyConfirm,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    opacity: copyTargets.length === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {t('proAvailability.copy.confirm')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  memberDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  slotsContainer: {
    flex: 1,
    gap: 6,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    marginLeft: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  pickerHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 1,
  },
  copyModal: {
    position: 'absolute',
    top: '20%',
    left: 24,
    right: 24,
    padding: 20,
  },
  copyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  copyCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  copyConfirm: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  // Templates
  templateCard: {
    width: 140,
    padding: 12,
    borderWidth: 1,
  },
  templateIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
