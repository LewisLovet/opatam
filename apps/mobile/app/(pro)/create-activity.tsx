/**
 * Create Activity Screen
 *
 * Adds a typed personal activity to the pro's calendar (sport, meeting,
 * admin, …). Backed by the same `blockedSlots` collection as
 * "Bloquer une période" — see packages/shared/src/types/index.ts. The
 * presence of `category` is what flips a blocked-slot doc into the
 * activity flavour at render time.
 *
 * Two scope guarantees vs. block-slot:
 *   - single member (the default member, or the one passed in via the
 *     URL param). No multi-select — activities are personal events,
 *     not team-wide.
 *   - single day (start/end have the same date). The form intentionally
 *     omits an end-date picker; for multi-day items the user should
 *     reach for "Bloquer une période" instead.
 */

import React, { useState, useEffect } from 'react';
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
import { Text, Button, Card, Input, Loader, SubscriptionRequiredModal } from '../../components';
import { useProvider, useSubscriptionStatus } from '../../contexts';
import {
  schedulingService,
  memberService,
  blockedSlotRepository,
} from '@booking-app/firebase';
import type { Member, ActivityCategory } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

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

// ─── Category palette ─────────────────────────────────────────────────
// Single source of truth for category visuals lives in
// components/business/Activity/categoryMeta.ts — both this create
// sheet and the Planning list pull from there so a sport activity
// always reads "orange + dumbbell" wherever it appears.
import {
  ACTIVITY_CATEGORY_META,
  ACTIVITY_CATEGORY_ORDER,
} from '../../components/business/Activity/categoryMeta';

interface CategoryDef {
  key: ActivityCategory;
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryDef[] = ACTIVITY_CATEGORY_ORDER.map((key) => ({
  key,
  label: ACTIVITY_CATEGORY_META[key].label,
  color: ACTIVITY_CATEGORY_META[key].color,
  icon: ACTIVITY_CATEGORY_META[key].icon as keyof typeof Ionicons.glyphMap,
}));

// ─── Time wheel picker ────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const WHEEL_ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

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

  const handleMomentumScrollEnd = (e: any) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
    const value = data[Math.max(0, Math.min(index, data.length - 1))];
    if (value !== selectedValue) onValueChange(value);
  };

  return (
    <FlatList
      ref={flatListRef}
      data={data}
      keyExtractor={(item) => String(item)}
      style={s.wheel}
      contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      decelerationRate="fast"
      onMomentumScrollEnd={handleMomentumScrollEnd}
      renderItem={({ item }) => {
        const isSelected = item === selectedValue;
        return (
          <View style={[s.wheelItem, { height: WHEEL_ITEM_HEIGHT }]}>
            <Text
              variant="h2"
              style={{
                color: isSelected ? colors.text : colors.textMuted,
                fontWeight: isSelected ? '700' : '400',
              }}
            >
              {formatLabel(item)}
            </Text>
          </View>
        );
      }}
      getItemLayout={(_, index) => ({
        length: WHEEL_ITEM_HEIGHT,
        offset: WHEEL_ITEM_HEIGHT * index,
        index,
      })}
    />
  );
}

function TimePickerModal({
  visible,
  title,
  initialHour,
  initialMinute,
  onClose,
  onConfirm,
  colors,
  spacing,
  radius,
}: {
  visible: boolean;
  title: string;
  initialHour: number;
  initialMinute: number;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
  colors: any;
  spacing: any;
  radius: any;
}) {
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(initialMinute);
  const padTwo = (n: number) => n.toString().padStart(2, '0');

  useEffect(() => {
    if (visible) {
      setSelectedHour(initialHour);
      setSelectedMinute(initialMinute);
    }
  }, [visible, initialHour, initialMinute]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalSheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
          <View style={[s.modalHeader, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text variant="body" color="textSecondary">Annuler</Text>
            </Pressable>
            <Text variant="body" style={{ fontWeight: '600' }}>{title}</Text>
            <Pressable onPress={() => onConfirm(selectedHour, selectedMinute)} hitSlop={8}>
              <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
            </Pressable>
          </View>
          <View style={[s.wheelsContainer, { paddingVertical: spacing.lg }]}>
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
            <View style={s.wheelColumn}>
              <ScrollWheel
                data={HOURS}
                selectedValue={selectedHour}
                onValueChange={setSelectedHour}
                formatLabel={padTwo}
                colors={colors}
              />
            </View>
            <Text variant="h2" style={{ fontWeight: '700', color: colors.text, alignSelf: 'center' }}>:</Text>
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

// ─── Main screen ───────────────────────────────────────────────────────

type PickerMode = 'date' | 'startTime' | 'endTime' | null;

export default function CreateActivityScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { providerId } = useProvider();
  const sub = useSubscriptionStatus();
  const { date: dateParam, memberId: memberIdParam, id: editId } =
    useLocalSearchParams<{
      date?: string;
      memberId?: string;
      // When set, the screen runs in edit mode: hydrates from the
      // existing blockedSlot doc and PATCHes via repository.update
      // on submit instead of creating a new one.
      id?: string;
    }>();
  const isEditing = !!editId;

  const [showSubModal, setShowSubModal] = useState(false);
  useEffect(() => {
    if (sub.needsSubscription) setShowSubModal(true);
  }, [sub.needsSubscription]);

  const initialDate = (() => {
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        // Default to "now" hours but on the requested calendar day.
        const d = new Date(parsed);
        const now = new Date();
        d.setHours(now.getHours(), 0, 0, 0);
        return d;
      }
    }
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  })();

  // Form state
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  // Default to "prestation" — the most likely reason a pro logs
  // an activity with an amount (paid off-platform work). Lowers
  // the friction of the common case while still letting the user
  // override to sport / perso / etc.
  const [category, setCategory] = useState<ActivityCategory>('prestation');
  const [title, setTitle] = useState('');
  const [activityDate, setActivityDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(initialDate);
    return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date(initialDate);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  // Amount earned for this activity, as a free-text input. Stored
  // in euros for the form (so the user types "120" / "120.50") and
  // converted to cents at submit time. Empty string = no amount,
  // persisted as null on the doc.
  const [amount, setAmount] = useState('');
  const [activePicker, setActivePicker] = useState<PickerMode>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load members + auto-select default; in edit mode also hydrate
  // form state from the existing blockedSlot doc.
  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;
    (async () => {
      try {
        const memberResult = (await memberService.getByProvider(providerId)) as WithId<Member>[];
        const activeMembers = memberResult.filter((m) => m.isActive);
        if (cancelled) return;
        setMembers(activeMembers);

        // ── Edit mode: hydrate from existing doc ────────────────
        if (editId) {
          const existing = await blockedSlotRepository.getById(providerId, editId);
          if (cancelled) return;
          if (!existing) {
            Alert.alert('Activité introuvable', 'Cette activité a été supprimée.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
            return;
          }
          const startDt =
            existing.startDate instanceof Date
              ? existing.startDate
              : (existing.startDate as any).toDate();
          const endDt =
            existing.endDate instanceof Date
              ? existing.endDate
              : (existing.endDate as any).toDate();
          setSelectedMemberId(existing.memberId);
          if (existing.category) setCategory(existing.category);
          setTitle(existing.title || '');
          setActivityDate(startDt);
          setStartTime(startDt);
          setEndTime(endDt);
          setAddress(existing.address || '');
          setNotes(existing.reason || '');
          // Hydrate amount from cents → euros string. Display 2
          // decimals only when needed so "12000" cents shows as
          // "120" not "120.00".
          if (existing.amount != null && existing.amount > 0) {
            const euros = existing.amount / 100;
            setAmount(
              euros % 1 === 0 ? String(euros) : euros.toFixed(2),
            );
          } else {
            setAmount('');
          }
          return;
        }

        // ── Create mode: pick a default member ──────────────────
        if (activeMembers.length === 0) return;
        const requested = memberIdParam
          ? activeMembers.find((m) => m.id === memberIdParam)
          : null;
        const fallback =
          activeMembers.find((m) => m.isDefault) || activeMembers[0];
        setSelectedMemberId((requested || fallback).id);
      } catch (err) {
        console.error('[create-activity] load failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId, memberIdParam, editId, router]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const activeCategory = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0];

  // ─── Pickers ────────────────────────────────────────────────────────

  const handleDateChange = (date: Date) => {
    // Preserve time component, just change the calendar day.
    const newDate = new Date(date);
    newDate.setHours(activityDate.getHours(), activityDate.getMinutes(), 0, 0);
    setActivityDate(newDate);
    // Sync start/end to the new day
    const newStart = new Date(date);
    newStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    setStartTime(newStart);
    const newEnd = new Date(date);
    newEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    setEndTime(newEnd);
  };

  const handleTimeConfirm = (hour: number, minute: number) => {
    if (activePicker === 'startTime') {
      const d = new Date(activityDate);
      d.setHours(hour, minute, 0, 0);
      setStartTime(d);
      // Auto-bump end time if it's now before/equal to start
      if (d >= endTime) {
        const newEnd = new Date(d);
        newEnd.setHours(d.getHours() + 1);
        setEndTime(newEnd);
      }
    } else if (activePicker === 'endTime') {
      const d = new Date(activityDate);
      d.setHours(hour, minute, 0, 0);
      setEndTime(d);
    }
    setActivePicker(null);
  };

  // ─── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!providerId) return;
    if (!selectedMember) {
      Alert.alert('Erreur', 'Veuillez sélectionner un membre');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Donnez un nom à votre activité (ex : « Crossfit »).');
      return;
    }
    if (endTime <= startTime) {
      Alert.alert('Heures invalides', "L'heure de fin doit être après l'heure de début.");
      return;
    }

    // Parse the optional amount input (euros → cents). Empty string,
    // dash, or only whitespace = null. Reject NaN / negative.
    const trimmedAmount = amount.trim().replace(',', '.');
    let amountCents: number | null = null;
    if (trimmedAmount.length > 0) {
      const parsed = Number.parseFloat(trimmedAmount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert('Montant invalide', 'Saisissez un montant en euros (ex : 120 ou 89,50).');
        return;
      }
      amountCents = Math.round(parsed * 100);
    }

    try {
      setIsSubmitting(true);
      if (editId) {
        // Edit path: PATCH only the fields the form covers. We don't
        // re-validate via blockPeriod (which always creates) — going
        // straight through the repo lets the doc keep its createdAt.
        await blockedSlotRepository.update(providerId, editId, {
          memberId: selectedMember.id,
          locationId: selectedMember.locationId,
          startDate: startTime,
          endDate: endTime,
          allDay: false,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime),
          reason: notes.trim() || null,
          category,
          title: title.trim(),
          address: address.trim() || null,
          amount: amountCents,
        });
        Alert.alert('Activité modifiée', `${title.trim()} a été mis à jour.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await schedulingService.blockPeriod(providerId, {
          memberId: selectedMember.id,
          locationId: selectedMember.locationId,
          startDate: startTime,
          endDate: endTime,
          allDay: false,
          isRecurring: false,
          startTime: formatTime(startTime),
          endTime: formatTime(endTime),
          reason: notes.trim() || null,
          category,
          title: title.trim(),
          address: address.trim() || null,
          amount: amountCents,
        });
        Alert.alert('Activité ajoutée', `${title.trim()} a été ajouté à votre agenda.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert(
        'Erreur',
        error instanceof Error ? error.message : "Impossible d'enregistrer l'activité",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete (only when editing) ─────────────────────────────────────
  // Two-step confirm to avoid accidental taps. Returns to the
  // calendar on success — the calendar's useFocusEffect picks up
  // the change and re-fetches blockedSlots automatically.
  const handleDelete = () => {
    if (!editId || !providerId) return;
    Alert.alert(
      "Supprimer l'activité ?",
      `« ${title.trim() || 'Cette activité'} » sera retirée de votre agenda.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await schedulingService.unblockPeriod(providerId, editId);
              router.back();
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert(
                'Erreur',
                error instanceof Error
                  ? error.message
                  : "Impossible de supprimer l'activité",
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
        <View style={s.center}><Loader /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      <SubscriptionRequiredModal
        visible={showSubModal}
        onClose={() => { setShowSubModal(false); router.back(); }}
        context="Créez des activités personnelles dans votre agenda avec un abonnement Pro."
      />

      {/* Header */}
      <View style={[s.header, { padding: spacing.lg, paddingBottom: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ marginLeft: spacing.md, flex: 1 }}>
          {isEditing ? "Modifier l'activité" : 'Nouvelle activité'}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, paddingBottom: spacing['3xl'] }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {/* Category chip row */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
              marginLeft: spacing.xs,
            }}
          >
            Catégorie
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {CATEGORIES.map((cat) => {
                const isSelected = cat.key === category;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setCategory(cat.key)}
                    style={[
                      s.chip,
                      {
                        backgroundColor: isSelected ? cat.color : colors.surface,
                        borderColor: isSelected ? cat.color : colors.border,
                        borderRadius: radius.full,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={16}
                      color={isSelected ? '#fff' : cat.color}
                    />
                    <Text
                      variant="bodySmall"
                      style={{
                        color: isSelected ? '#fff' : colors.text,
                        fontWeight: '500',
                      }}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Title */}
        <View style={{ marginBottom: spacing.lg }}>
          <Input
            label="Titre"
            placeholder="ex : Crossfit, Déjeuner avec…"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            maxLength={80}
          />
        </View>

        {/* Member (only if multi-member) */}
        {members.length > 1 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text
              variant="caption"
              color="textSecondary"
              style={{
                marginBottom: spacing.sm,
                textTransform: 'uppercase',
                fontWeight: '600',
                letterSpacing: 0.5,
                marginLeft: spacing.xs,
              }}
            >
              Pour
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {members.map((member) => {
                  const isSelected = member.id === selectedMemberId;
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => setSelectedMemberId(member.id)}
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
                        style={{
                          color: isSelected ? '#fff' : colors.text,
                          fontWeight: '500',
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

        {/* Date + time card */}
        <Card padding="md" style={{ marginBottom: spacing.lg }}>
          <Pressable
            onPress={() => setActivePicker('date')}
            style={[s.row, { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="caption" color="textSecondary">Date</Text>
              <Text variant="body" style={{ fontWeight: '500' }}>
                {formatDateShort(activityDate)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => setActivePicker('startTime')}
            style={[s.row, { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="caption" color="textSecondary">Début</Text>
              <Text variant="body" style={{ fontWeight: '500' }}>
                {formatTime(startTime)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => setActivePicker('endTime')}
            style={[s.row, { paddingVertical: spacing.md }]}
          >
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="caption" color="textSecondary">Fin</Text>
              <Text variant="body" style={{ fontWeight: '500' }}>
                {formatTime(endTime)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Card>

        {/* Address (optional) */}
        <View style={{ marginBottom: spacing.lg }}>
          <Input
            label="Adresse (optionnel)"
            placeholder="ex : Salle de sport, 12 rue X"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="sentences"
            maxLength={200}
          />
        </View>

        {/* Notes (optional) */}
        <View style={{ marginBottom: spacing.lg }}>
          <Input
            label="Notes (optionnel)"
            placeholder="Ajouter des notes…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        {/* Amount (optional) — for paid activities (workshop, gig…)
            Currently shown as a badge on the calendar card. Will be
            aggregated into "Autres revenus" in the stats Phase 2. */}
        <View style={{ marginBottom: spacing.lg }}>
          <Input
            label="Montant facturé (optionnel)"
            placeholder="0"
            value={amount}
            onChangeText={(v) => {
              // Allow digits + one comma/dot for cents. Strip the rest.
              const cleaned = v.replace(/[^0-9.,]/g, '').replace(',', '.');
              const dotCount = (cleaned.match(/\./g) || []).length;
              if (dotCount > 1) return; // refuse second decimal point
              setAmount(cleaned);
            }}
            keyboardType="decimal-pad"
            maxLength={10}
            helperText="Pour une activité rémunérée hors plateforme. Affiché comme badge sur l'agenda."
          />
        </View>

        {/* Submit */}
        <Button
          title={
            isSubmitting
              ? isEditing
                ? 'Enregistrement…'
                : 'Création…'
              : isEditing
                ? 'Enregistrer les modifications'
                : "Ajouter à l'agenda"
          }
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={{ backgroundColor: activeCategory.color }}
        />

        {/* Delete — only when editing an existing activity. Two-step
            confirm in handleDelete so accidental taps don't lose
            data. Hidden during create flow where there's nothing to
            delete yet. */}
        {isEditing && (
          <Pressable
            onPress={handleDelete}
            disabled={isSubmitting}
            style={({ pressed }) => [
              {
                marginTop: spacing.md,
                paddingVertical: spacing.md,
                alignItems: 'center',
                opacity: isSubmitting ? 0.5 : pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text variant="body" style={{ color: '#DC2626', fontWeight: '600' }}>
              Supprimer cette activité
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Time picker */}
      <TimePickerModal
        visible={activePicker === 'startTime' || activePicker === 'endTime'}
        title={activePicker === 'startTime' ? 'Heure de début' : 'Heure de fin'}
        initialHour={
          activePicker === 'startTime' ? startTime.getHours() : endTime.getHours()
        }
        initialMinute={
          activePicker === 'startTime' ? startTime.getMinutes() : endTime.getMinutes()
        }
        onClose={() => setActivePicker(null)}
        onConfirm={handleTimeConfirm}
        colors={colors}
        spacing={spacing}
        radius={radius}
      />

      {/* Date picker — native */}
      {activePicker === 'date' && Platform.OS === 'android' && (
        <DateTimePicker
          value={activityDate}
          mode="date"
          minimumDate={new Date()}
          onChange={(_: any, date: Date | undefined) => {
            setActivePicker(null);
            if (date) handleDateChange(date);
          }}
        />
      )}
      {activePicker === 'date' && Platform.OS === 'ios' && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setActivePicker(null)}>
          <View style={s.modalOverlay}>
            <View
              style={[
                s.modalSheet,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                },
              ]}
            >
              <View
                style={[
                  s.modalHeader,
                  {
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Pressable onPress={() => setActivePicker(null)} hitSlop={8}>
                  <Text variant="body" color="textSecondary">Annuler</Text>
                </Pressable>
                <Text variant="body" style={{ fontWeight: '600' }}>Date</Text>
                <Pressable onPress={() => setActivePicker(null)} hitSlop={8}>
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={activityDate}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={(_: any, date: Date | undefined) => {
                  if (date) handleDateChange(date);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  wheelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  wheelColumn: {
    flex: 1,
    height: WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS,
  },
  wheel: { height: WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS },
  wheelItem: { alignItems: 'center', justifyContent: 'center' },
});
