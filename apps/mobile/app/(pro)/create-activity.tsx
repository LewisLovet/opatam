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

import React, { useState, useEffect, useMemo } from 'react';
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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import i18n from '../../lib/i18n';
import { useTheme } from '../../theme';
import { Text, Input, Loader, SubscriptionRequiredModal } from '../../components';
import { useProvider, useSubscriptionStatus } from '../../contexts';
import {
  schedulingService,
  memberService,
  blockedSlotRepository,
} from '@booking-app/firebase';
import type { Member, ActivityCategory } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

function formatDateShort(date: Date): string {
  // Locale-aware short date ("6 janv. 2026" / "Jan 6, 2026") — follows
  // the app language instead of a hardcoded French month list.
  return new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/** « jeu. 14 sept. » — la date du bandeau, courte et dans la langue de l'app. */
function formatDateBandeau(date: Date): string {
  return new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/** 90 → « 1 h 30 », 45 → « 45 min », 120 → « 2 h ». Lisible dans les cinq langues. */
function formatDuree(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Assombrit une couleur hex — la seconde teinte du dégradé de bandeau. */
function assombrir(hex: string, ratio = 0.28): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - ratio));
  const g = Math.round(((n >> 8) & 255) * (1 - ratio));
  const b = Math.round((n & 255) * (1 - ratio));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Durées proposées d'un geste sous les heures. */
const DUREES_RAPIDES = [30, 60, 90, 120];

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

/**
 * Les catégories, dans la langue de l'app.
 *
 * `ACTIVITY_CATEGORY_META` porte un `label` en dur, en français : vivant dans
 * une constante partagée et non dans les dictionnaires, il a échappé à la
 * campagne de traduction de l'espace pro. Un professionnel en anglais voyait
 * « Prestation », « Imprévu », « Trajet » au milieu d'une interface anglaise.
 *
 * Recalculé à chaque rendu, jamais figé au chargement du module : changer de
 * langue ne remonte pas le module, et une liste construite une fois pour
 * toutes resterait dans la langue du démarrage.
 */
function useActivityCategories(): CategoryDef[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      ACTIVITY_CATEGORY_ORDER.map((key) => ({
        key,
        // `defaultValue` : une catégorie ajoutée sans sa clé retombe sur le
        // libellé français plutôt que d'afficher son identifiant brut.
        label: t(`activityCategories.${key}`, { defaultValue: ACTIVITY_CATEGORY_META[key].label }),
        color: ACTIVITY_CATEGORY_META[key].color,
        icon: ACTIVITY_CATEGORY_META[key].icon as keyof typeof Ionicons.glyphMap,
      })),
    [t],
  );
}

// ─── Time wheel picker ────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// Pas de 5 min + 59 : permet de finir une activité à 23:59 (« fin de journée »),
// alternative à minuit que l'écran Activité — mono-date — ne peut pas gérer.
const MINUTES = [...Array.from({ length: 12 }, (_, i) => i * 5), 59];
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
  const { t } = useTranslation();
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
              <Text variant="body" color="textSecondary">{t('common.cancel')}</Text>
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
  const { t } = useTranslation();
  const CATEGORIES = useActivityCategories();
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
            Alert.alert(
              i18n.t('proActivity.notFoundTitle'),
              i18n.t('proActivity.notFoundMessage'),
              [{ text: 'OK', onPress: () => router.back() }],
            );
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
      Alert.alert(t('proActivity.errorTitle'), t('proActivity.selectMember'));
      return;
    }
    if (!title.trim()) {
      Alert.alert(t('proActivity.titleRequiredTitle'), t('proActivity.titleRequiredMessage'));
      return;
    }
    if (endTime <= startTime) {
      Alert.alert(t('proActivity.invalidTimesTitle'), t('proActivity.invalidTimesMessage'));
      return;
    }

    // Parse the optional amount input (euros → cents). Empty string,
    // dash, or only whitespace = null. Reject NaN / negative.
    const trimmedAmount = amount.trim().replace(',', '.');
    let amountCents: number | null = null;
    if (trimmedAmount.length > 0) {
      const parsed = Number.parseFloat(trimmedAmount);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert(t('proActivity.invalidAmountTitle'), t('proActivity.invalidAmountMessage'));
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
        Alert.alert(
          t('proActivity.updatedTitle'),
          t('proActivity.updatedMessage', { title: title.trim() }),
          [{ text: 'OK', onPress: () => router.back() }],
        );
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
        Alert.alert(
          t('proActivity.addedTitle'),
          t('proActivity.addedMessage', { title: title.trim() }),
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert(
        t('proActivity.errorTitle'),
        error instanceof Error ? error.message : t('proActivity.saveError'),
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
      t('proActivity.deleteConfirmTitle'),
      t('proActivity.deleteConfirmMessage', {
        title: title.trim() || t('proActivity.thisActivity'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proActivity.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await schedulingService.unblockPeriod(providerId, editId);
              router.back();
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert(
                t('proActivity.errorTitle'),
                error instanceof Error
                  ? error.message
                  : t('proActivity.deleteError'),
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

  // ── Ce que l'écran raconte ──
  // La couleur de la catégorie teinte tout l'écran : bandeau, tuile
  // choisie, bouton d'enregistrement. Le bandeau reprend en direct ce
  // que le professionnel saisit — titre, jour, heures, durée — pour
  // qu'il voie son activité prendre forme avant de la valider.
  const teinte = activeCategory.color;
  const teinteSombre = assombrir(teinte);
  const dureeMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  const titreAffiche = title.trim();

  const appliquerDuree = (minutes: number) => {
    const d = new Date(startTime);
    d.setMinutes(d.getMinutes() + minutes);
    // Mono-date : au-delà de minuit, on cale à 23:59, comme la roue le permet.
    if (d.getDate() !== startTime.getDate()) {
      d.setTime(startTime.getTime());
      d.setHours(23, 59, 0, 0);
    }
    setEndTime(d);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <SubscriptionRequiredModal
        visible={showSubModal}
        onClose={() => { setShowSubModal(false); router.back(); }}
        context={t('proActivity.subscriptionContext')}
      />

      {/* ── Bandeau : la catégorie donne la couleur, la saisie donne le contenu ── */}
      <LinearGradient
        colors={[teinte, teinteSombre]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.bandeau}
      >
        <SafeAreaView>
          <View style={s.bandeauDecor1} />
          <View style={s.bandeauDecor2} />
          <View style={[s.bandeauBarre, { paddingHorizontal: spacing.lg }]}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={s.boutonRond}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <Text style={s.bandeauTitre}>
              {isEditing ? t('proActivity.editTitle') : t('proActivity.newTitle')}
            </Text>
            {isEditing ? (
              <Pressable onPress={handleDelete} hitSlop={10} style={s.boutonRond} disabled={isSubmitting}>
                <Ionicons name="trash-outline" size={19} color="#fff" />
              </Pressable>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>

          <View style={[s.recap, { marginHorizontal: spacing.lg }]}>
            <View style={s.recapIcone}>
              <Ionicons name={activeCategory.icon} size={26} color={teinte} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.recapCategorie}>{activeCategory.label.toUpperCase()}</Text>
              <Text style={[s.recapTitre, !titreAffiche && s.recapTitreVide]} numberOfLines={2}>
                {titreAffiche || t('proActivity.recapPlaceholder')}
              </Text>
              <View style={s.recapLigne}>
                <Ionicons name="calendar-clear-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={s.recapMeta}>{formatDateBandeau(activityDate)}</Text>
                <Text style={s.recapPoint}>·</Text>
                <Text style={s.recapMeta}>{formatTime(startTime)} – {formatTime(endTime)}</Text>
                <View style={s.recapDuree}>
                  <Text style={s.recapDureeTexte}>{formatDuree(dureeMinutes)}</Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* ── Catégorie : des tuiles, toutes visibles, pas un ruban qui coupe la cinquième ── */}
        <Text style={[s.sectionTitre, { color: colors.textSecondary }]}>{t('proActivity.category')}</Text>
        <View style={s.tuiles}>
          {CATEGORIES.map((cat) => {
            const isSelected = cat.key === category;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setCategory(cat.key)}
                style={({ pressed }) => [
                  s.tuile,
                  {
                    backgroundColor: isSelected ? `${cat.color}1A` : colors.surface,
                    borderColor: isSelected ? cat.color : colors.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View style={[s.tuileIcone, { backgroundColor: isSelected ? cat.color : `${cat.color}1F` }]}>
                  <Ionicons name={cat.icon} size={18} color={isSelected ? '#fff' : cat.color} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[s.tuileLabel, { color: isSelected ? cat.color : colors.text, fontWeight: isSelected ? '700' : '600' }]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Titre ── */}
        <Text style={[s.sectionTitre, { color: colors.textSecondary, marginTop: spacing.xl }]}>{t('proActivity.titleLabel')}</Text>
        <Input
          placeholder={t('proActivity.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          maxLength={80}
          leftIcon={<Ionicons name="pencil-outline" size={18} color={teinte} />}
        />

        {/* ── Pour qui (équipes seulement) ── */}
        {members.length > 1 && (
          <>
            <Text style={[s.sectionTitre, { color: colors.textSecondary, marginTop: spacing.xl }]}>{t('proActivity.forLabel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {members.map((member) => {
                const isSelected = member.id === selectedMemberId;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => setSelectedMemberId(member.id)}
                    style={[
                      s.membre,
                      {
                        backgroundColor: isSelected ? teinte : colors.surface,
                        borderColor: isSelected ? teinte : colors.border,
                      },
                    ]}
                  >
                    <View style={[s.membreInitiale, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : `${teinte}1F` }]}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: isSelected ? '#fff' : teinte }}>
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: isSelected ? '#fff' : colors.text }}>
                      {member.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* ── Quand : la date, puis début et fin côte à côte, puis les durées d'un geste ── */}
        <Text style={[s.sectionTitre, { color: colors.textSecondary, marginTop: spacing.xl }]}>{t('proActivity.whenLabel')}</Text>
        <View style={[s.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable onPress={() => setActivePicker('date')} style={[s.ligneDate, { borderBottomColor: colors.border }]}>
            <View style={[s.pastille, { backgroundColor: `${teinte}1F` }]}>
              <Ionicons name="calendar-outline" size={18} color={teinte} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.champLabel, { color: colors.textSecondary }]}>{t('proActivity.date')}</Text>
              <Text style={[s.champValeur, { color: colors.text }]}>{formatDateShort(activityDate)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={s.heures}>
            <Pressable onPress={() => setActivePicker('startTime')} style={[s.heure, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[s.champLabel, { color: colors.textSecondary }]}>{t('proActivity.start')}</Text>
              <Text style={[s.heureValeur, { color: colors.text }]}>{formatTime(startTime)}</Text>
            </Pressable>
            <View style={[s.heureFleche, { backgroundColor: teinte }]}>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
            <Pressable onPress={() => setActivePicker('endTime')} style={[s.heure, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[s.champLabel, { color: colors.textSecondary }]}>{t('proActivity.end')}</Text>
              <Text style={[s.heureValeur, { color: colors.text }]}>{formatTime(endTime)}</Text>
            </Pressable>
          </View>

          <View style={s.durees}>
            <Text style={[s.champLabel, { color: colors.textSecondary, marginRight: 4 }]}>{t('proActivity.durationLabel')}</Text>
            {DUREES_RAPIDES.map((minutes) => {
              const actif = dureeMinutes === minutes;
              return (
                <Pressable
                  key={minutes}
                  onPress={() => appliquerDuree(minutes)}
                  style={[
                    s.duree,
                    { backgroundColor: actif ? teinte : colors.surface, borderColor: actif ? teinte : colors.border },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: actif ? '#fff' : colors.text }}>
                    {formatDuree(minutes)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Détails, facultatifs ── */}
        <View style={[s.sectionLigne, { marginTop: spacing.xl }]}>
          <Text style={[s.sectionTitre, { color: colors.textSecondary, marginBottom: 0 }]}>{t('proActivity.detailsLabel')}</Text>
          <Text style={[s.facultatif, { color: colors.textMuted }]}>{t('proActivity.optional')}</Text>
        </View>
        <View style={[s.carte, { backgroundColor: colors.surface, borderColor: colors.border, gap: spacing.md }]}>
          <Input
            placeholder={t('proActivity.addressPlaceholder')}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="sentences"
            maxLength={200}
            leftIcon={<Ionicons name="location-outline" size={18} color={teinte} />}
          />
          <Input
            placeholder={t('proActivity.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            maxLength={200}
            leftIcon={<Ionicons name="create-outline" size={18} color={teinte} />}
          />
        </View>

        {/* ── Rémunération hors plateforme ── */}
        <View style={[s.sectionLigne, { marginTop: spacing.xl }]}>
          <Text style={[s.sectionTitre, { color: colors.textSecondary, marginBottom: 0 }]}>{t('proActivity.paymentLabel')}</Text>
          <Text style={[s.facultatif, { color: colors.textMuted }]}>{t('proActivity.optional')}</Text>
        </View>
        <View style={[s.carte, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Input
            placeholder="0"
            value={amount}
            onChangeText={(v) => {
              // Chiffres et une seule virgule ou un seul point pour les centimes.
              const cleaned = v.replace(/[^0-9.,]/g, '').replace(',', '.');
              const dotCount = (cleaned.match(/\./g) || []).length;
              if (dotCount > 1) return;
              setAmount(cleaned);
            }}
            keyboardType="decimal-pad"
            maxLength={10}
            leftIcon={<Ionicons name="cash-outline" size={18} color={teinte} />}
            rightIcon={<Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary }}>€</Text>}
          />
          <Text style={[s.aide, { color: colors.textMuted }]}>{t('proActivity.amountHelper')}</Text>
        </View>
      </ScrollView>

      {/* ── Pied fixe : toujours à portée de pouce, quelle que soit la longueur du formulaire ── */}
      <View style={[s.pied, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [s.piedBouton, { backgroundColor: teinte, opacity: isSubmitting ? 0.7 : pressed ? 0.9 : 1 }]}
        >
          <Ionicons name={isEditing ? 'checkmark' : 'add'} size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={s.piedTexte}>
              {isSubmitting
                ? (isEditing ? t('proActivity.saving') : t('proActivity.creating'))
                : (isEditing ? t('proActivity.saveChanges') : t('proActivity.addToCalendar'))}
            </Text>
            <Text style={s.piedSous}>
              {formatDateBandeau(activityDate)} · {formatTime(startTime)} · {formatDuree(dureeMinutes)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>

      {/* Roue des heures */}
      <TimePickerModal
        visible={activePicker === 'startTime' || activePicker === 'endTime'}
        title={activePicker === 'startTime' ? t('proActivity.startTimeTitle') : t('proActivity.endTimeTitle')}
        initialHour={activePicker === 'startTime' ? startTime.getHours() : endTime.getHours()}
        initialMinute={activePicker === 'startTime' ? startTime.getMinutes() : endTime.getMinutes()}
        onClose={() => setActivePicker(null)}
        onConfirm={handleTimeConfirm}
        colors={colors}
        spacing={spacing}
        radius={radius}
      />

      {/* Sélecteur de date — natif */}
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
            <View style={[s.modalSheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
              <View style={[s.modalHeader, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomColor: colors.border }]}>
                <Pressable onPress={() => setActivePicker(null)} hitSlop={8}>
                  <Text variant="body" color="textSecondary">{t('common.cancel')}</Text>
                </Pressable>
                <Text variant="body" style={{ fontWeight: '600' }}>{t('proActivity.date')}</Text>
                <Pressable onPress={() => setActivePicker(null)} hitSlop={8}>
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>OK</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={activityDate}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={(_: any, date: Date | undefined) => { if (date) handleDateChange(date); }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Bandeau
  bandeau: { paddingBottom: 18, overflow: 'hidden' },
  bandeauDecor1: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)' },
  bandeauDecor2: { position: 'absolute', bottom: -70, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(0,0,0,0.08)' },
  bandeauBarre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 14 },
  bandeauTitre: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  boutonRond: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  recap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  recapIcone: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recapCategorie: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  recapTitre: { color: '#fff', fontSize: 19, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  recapTitreVide: { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  recapLigne: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' },
  recapMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: '600' },
  recapPoint: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5 },
  recapDuree: { marginLeft: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#fff' },
  recapDureeTexte: { fontSize: 11, fontWeight: '800', color: '#1f2937' },

  // Sections
  sectionTitre: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 },
  sectionLigne: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  facultatif: { fontSize: 11, fontWeight: '600' },
  carte: { borderWidth: 1, borderRadius: 18, padding: 14 },

  // Catégories
  tuiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tuile: {
    width: '31.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  tuileIcone: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tuileLabel: { fontSize: 13, flexShrink: 1 },

  // Membres
  membre: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  membreInitiale: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Quand
  ligneDate: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 1, marginBottom: 14 },
  pastille: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  champLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  champValeur: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  heures: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heure: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  heureValeur: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  heureFleche: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  durees: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' },
  duree: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  aide: { fontSize: 12, lineHeight: 17, marginTop: 8 },

  // Pied
  pied: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, borderTopWidth: 1 },
  piedBouton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16 },
  piedTexte: { color: '#fff', fontSize: 16, fontWeight: '800' },
  piedSous: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },

  // Sélecteurs (inchangés)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { minHeight: 300 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  wheelsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  wheelHighlight: { position: 'absolute', left: 0, right: 0 },
  wheelColumn: { flex: 1, height: WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS },
  wheel: { height: WHEEL_ITEM_HEIGHT * VISIBLE_ITEMS },
  wheelItem: { alignItems: 'center', justifyContent: 'center' },
});
