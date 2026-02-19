/**
 * Block Slot Screen
 * Form to create a blocked period (vacation, absence, etc.)
 * Uses inline date picker in modal + custom time grid picker (cross-platform).
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../theme';
import { Text, Button, Card, Switch, Input, Loader } from '../../components';
import { useProvider } from '../../contexts';
import { schedulingService, memberService } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDateShort(date: Date): string {
  return `${date.getDate()} ${months[date.getMonth()].slice(0, 3)}. ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Data for scroll wheels
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ... 55
const WHEEL_ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5; // Number of items visible in the wheel
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS;
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

// ---------------------------------------------------------------------------
// Scroll Wheel Component
// ---------------------------------------------------------------------------

function ScrollWheel({
  data,
  selectedValue,
  onValueChange,
  formatLabel,
  colors,
}: {
  data: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  formatLabel: (value: number) => string;
  colors: any;
}) {
  const flatListRef = React.useRef<FlatList>(null);
  const isUserScrolling = React.useRef(false);

  // Scroll to initial value on mount
  useEffect(() => {
    const index = data.indexOf(selectedValue);
    if (index >= 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: index * WHEEL_ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    }
  }, []);

  const handleMomentumEnd = useCallback(
    (e: any) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      onValueChange(data[clampedIndex]);
      isUserScrolling.current = false;
    },
    [data, onValueChange],
  );

  const renderItem = useCallback(
    ({ item }: { item: number }) => {
      const isSelected = item === selectedValue;
      return (
        <View style={[s.wheelItem, { height: WHEEL_ITEM_HEIGHT }]}>
          <Text
            variant="body"
            style={{
              fontSize: isSelected ? 24 : 18,
              fontWeight: isSelected ? '700' : '400',
              color: isSelected ? colors.text : colors.textMuted,
              opacity: isSelected ? 1 : 0.4,
            }}
          >
            {formatLabel(item)}
          </Text>
        </View>
      );
    },
    [selectedValue, colors, formatLabel],
  );

  return (
    <View style={{ height: WHEEL_HEIGHT, overflow: 'hidden' }}>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={() => { isUserScrolling.current = true; }}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingTop: WHEEL_PADDING,
          paddingBottom: WHEEL_PADDING,
        }}
        getItemLayout={(_, index) => ({
          length: WHEEL_ITEM_HEIGHT,
          offset: WHEEL_ITEM_HEIGHT * index,
          index,
        })}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Custom Time Picker Modal — Dual scroll wheels (H : M)
// ---------------------------------------------------------------------------

function TimePickerModal({
  visible,
  title,
  value,
  onClose,
  onConfirm,
  colors,
  spacing,
  radius,
}: {
  visible: boolean;
  title: string;
  value: Date;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
  colors: any;
  spacing: any;
  radius: any;
}) {
  const snap = (m: number) => { const r = Math.round(m / 5) * 5; return r >= 60 ? 0 : r; };
  const [selectedHour, setSelectedHour] = useState(value.getHours());
  const [selectedMinute, setSelectedMinute] = useState(snap(value.getMinutes()));

  // Reset when opening
  useEffect(() => {
    if (visible) {
      setSelectedHour(value.getHours());
      setSelectedMinute(snap(value.getMinutes()));
    }
  }, [visible, value]);

  const padTwo = useCallback((n: number) => n.toString().padStart(2, '0'), []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.pickerOverlay}>
        <Pressable style={s.pickerBackdrop} onPress={onClose} />
        <View style={[s.pickerSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View
            style={[
              s.pickerHeader,
              {
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Pressable onPress={onClose} hitSlop={8}>
              <Text variant="body" color="textSecondary">Annuler</Text>
            </Pressable>
            <Text variant="body" style={{ fontWeight: '600' }}>{title}</Text>
            <Pressable
              onPress={() => onConfirm(selectedHour, selectedMinute)}
              hitSlop={8}
            >
              <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>

          {/* Wheels */}
          <View style={[s.wheelsContainer, { paddingVertical: spacing.lg }]}>
            {/* Selection highlight bar */}
            <View
              style={[
                s.wheelHighlight,
                {
                  top: spacing.lg + WHEEL_PADDING,
                  height: WHEEL_ITEM_HEIGHT,
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.lg,
                  marginHorizontal: spacing['2xl'],
                },
              ]}
            />

            {/* Hour wheel */}
            <View style={s.wheelColumn}>
              <ScrollWheel
                data={HOURS}
                selectedValue={selectedHour}
                onValueChange={setSelectedHour}
                formatLabel={padTwo}
                colors={colors}
              />
            </View>

            {/* Separator */}
            <Text variant="h2" style={{ fontWeight: '700', color: colors.text, alignSelf: 'center' }}>
              :
            </Text>

            {/* Minute wheel */}
            <View style={s.wheelColumn}>
              <ScrollWheel
                data={MINUTES}
                selectedValue={selectedMinute}
                onValueChange={setSelectedMinute}
                formatLabel={padTwo}
                colors={colors}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Date Picker Modal (native inline — works great for dates)
// ---------------------------------------------------------------------------

function DatePickerModal({
  visible,
  title,
  value,
  minimumDate,
  onClose,
  onChange,
  colors,
  spacing,
}: {
  visible: boolean;
  title: string;
  value: Date;
  minimumDate?: Date;
  onClose: () => void;
  onChange: (date: Date) => void;
  colors: any;
  spacing: any;
}) {
  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode="date"
        minimumDate={minimumDate}
        onChange={(_: any, date: Date | undefined) => {
          onClose();
          if (date) onChange(date);
        }}
      />
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.pickerOverlay}>
        <Pressable style={s.pickerBackdrop} onPress={onClose} />
        <View style={[s.pickerSheet, { backgroundColor: colors.surface }]}>
          <View
            style={[
              s.pickerHeader,
              {
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              },
            ]}
          >
            <Pressable onPress={onClose} hitSlop={8}>
              <Text variant="body" color="textSecondary">Annuler</Text>
            </Pressable>
            <Text variant="body" style={{ fontWeight: '600' }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={value}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            themeVariant="light"
            onChange={(_, date) => {
              if (date) onChange(date);
            }}
            style={{ height: 340 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

type PickerMode = 'startDate' | 'endDate' | 'startTime' | 'endTime' | null;

export default function BlockSlotScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { providerId } = useProvider();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  const initialDate = (() => {
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  })();

  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [allDay, setAllDay] = useState(true);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerMode>(null);

  useEffect(() => {
    if (!providerId) return;
    memberService
      .getByProvider(providerId)
      .then((result) => {
        const activeMembers = (result as WithId<Member>[]).filter((m) => m.isActive);
        setMembers(activeMembers);
        if (activeMembers.length === 1) {
          setSelectedMemberIds([activeMembers[0].id]);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [providerId]);

  const allSelected = members.length > 0 && selectedMemberIds.length === members.length;

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedMemberIds(allSelected ? [] : members.map((m) => m.id));
  };

  const handleDateChange = (date: Date) => {
    if (activePicker === 'startDate') {
      setStartDate(date);
      if (date > endDate) setEndDate(date);
    } else if (activePicker === 'endDate') {
      setEndDate(date);
    }
  };

  const handleTimeConfirm = (hour: number, minute: number) => {
    if (activePicker === 'startTime') {
      const d = new Date(startDate);
      d.setHours(hour, minute, 0, 0);
      setStartDate(d);
    } else if (activePicker === 'endTime') {
      const d = new Date(endDate);
      d.setHours(hour, minute, 0, 0);
      setEndDate(d);
    }
    setActivePicker(null);
  };

  const handleSubmit = async () => {
    if (!providerId || selectedMemberIds.length === 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner au moins un membre');
      return;
    }

    try {
      setIsSubmitting(true);

      const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

      await Promise.all(
        selectedMembers.map((member) =>
          schedulingService.blockPeriod(providerId, {
            memberId: member.id,
            locationId: member.locationId,
            startDate,
            endDate,
            allDay,
            isRecurring: false,
            startTime: allDay ? null : formatTime(startDate),
            endTime: allDay ? null : formatTime(endDate),
            reason: reason.trim() || null,
          }),
        ),
      );

      const label = selectedMembers.length > 1
        ? `Créneau bloqué pour ${selectedMembers.length} membres`
        : 'Créneau bloqué avec succès';
      Alert.alert('Succès', label, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error blocking slot:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de bloquer le créneau');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.center}>
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  const isTimePicker = activePicker === 'startTime' || activePicker === 'endTime';
  const isDatePicker = activePicker === 'startDate' || activePicker === 'endDate';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { padding: spacing.lg, paddingBottom: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ marginLeft: spacing.md, flex: 1 }}>
          Bloquer un créneau
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing['3xl'] }}>
        {/* Member selection */}
        {members.length > 1 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5, marginLeft: spacing.xs }}>
              Membres
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Pressable
                  onPress={toggleAll}
                  style={[
                    s.chip,
                    {
                      backgroundColor: allSelected ? colors.primary : colors.surface,
                      borderColor: allSelected ? colors.primary : colors.border,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    style={{ color: allSelected ? '#fff' : colors.text, fontWeight: '500' }}
                  >
                    Tous
                  </Text>
                </Pressable>
                {members.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => toggleMember(member.id)}
                      style={[
                        s.chip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderRadius: radius.full,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                        },
                      ]}
                    >
                      <Text
                        variant="bodySmall"
                        style={{ color: isSelected ? '#fff' : colors.text, fontWeight: '500' }}
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

        {/* Period section */}
        <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5, marginLeft: spacing.xs }}>
          Période
        </Text>
        <Card padding="none" shadow="sm" style={{ marginBottom: spacing.lg }}>
          {/* All day toggle */}
          <View style={[s.cardRow, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
            <View style={[s.rowIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
              <Ionicons name="sunny-outline" size={18} color={colors.primary} />
            </View>
            <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>Journée entière</Text>
            <Switch value={allDay} onValueChange={setAllDay} />
          </View>
          <View style={[s.divider, { backgroundColor: colors.divider, marginLeft: spacing.lg + 36 + spacing.md }]} />

          {/* Start date */}
          <Pressable
            onPress={() => setActivePicker('startDate')}
            style={({ pressed }) => [s.cardRow, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' }]}
          >
            <View style={[s.rowIcon, { backgroundColor: '#DBEAFE', borderRadius: radius.md }]}>
              <Ionicons name="calendar-outline" size={18} color="#3B82F6" />
            </View>
            <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>Début</Text>
            <Text variant="body" color="primary" style={{ fontWeight: '500' }}>
              {formatDateShort(startDate)}
            </Text>
            {!allDay && (
              <Pressable onPress={() => setActivePicker('startTime')} hitSlop={8}>
                <View style={[s.timeBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.md, marginLeft: spacing.sm }]}>
                  <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>{formatTime(startDate)}</Text>
                </View>
              </Pressable>
            )}
          </Pressable>
          <View style={[s.divider, { backgroundColor: colors.divider, marginLeft: spacing.lg + 36 + spacing.md }]} />

          {/* End date */}
          <Pressable
            onPress={() => setActivePicker('endDate')}
            style={({ pressed }) => [s.cardRow, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' }]}
          >
            <View style={[s.rowIcon, { backgroundColor: '#FEE2E2', borderRadius: radius.md }]}>
              <Ionicons name="calendar-outline" size={18} color="#EF4444" />
            </View>
            <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>Fin</Text>
            <Text variant="body" color="primary" style={{ fontWeight: '500' }}>
              {formatDateShort(endDate)}
            </Text>
            {!allDay && (
              <Pressable onPress={() => setActivePicker('endTime')} hitSlop={8}>
                <View style={[s.timeBadge, { backgroundColor: colors.primaryLight, borderRadius: radius.md, marginLeft: spacing.sm }]}>
                  <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>{formatTime(endDate)}</Text>
                </View>
              </Pressable>
            )}
          </Pressable>
        </Card>

        {/* Reason section */}
        <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5, marginLeft: spacing.xs }}>
          Détails
        </Text>
        <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
          <Input
            label="Motif (optionnel)"
            value={reason}
            onChangeText={setReason}
            placeholder="Vacances, formation, etc."
          />
        </Card>

        {/* Submit */}
        <Button
          title={isSubmitting ? 'Blocage en cours...' : 'Bloquer le créneau'}
          variant="primary"
          onPress={handleSubmit}
          disabled={isSubmitting || selectedMemberIds.length === 0}
        />
      </ScrollView>

      {/* Date Picker Modal (native inline calendar) */}
      <DatePickerModal
        visible={isDatePicker}
        title={activePicker === 'startDate' ? 'Date de début' : 'Date de fin'}
        value={activePicker === 'startDate' ? startDate : endDate}
        minimumDate={activePicker === 'endDate' ? startDate : new Date()}
        onClose={() => setActivePicker(null)}
        onChange={handleDateChange}
        colors={colors}
        spacing={spacing}
      />

      {/* Custom Time Picker Modal */}
      <TimePickerModal
        visible={isTimePicker}
        title={activePicker === 'startTime' ? 'Heure de début' : 'Heure de fin'}
        value={activePicker === 'startTime' ? startDate : endDate}
        onClose={() => setActivePicker(null)}
        onConfirm={handleTimeConfirm}
        colors={colors}
        spacing={spacing}
        radius={radius}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  divider: {
    height: 1,
  },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chip: {
    borderWidth: 1,
  },
  // Scroll wheel
  wheelsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  wheelColumn: {
    width: 80,
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  // Picker modals
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
