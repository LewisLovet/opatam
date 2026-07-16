/**
 * Pro Calendar (Agenda) Screen
 * Modern agenda view with day/week toggle, member filtering,
 * and polished visual presentation.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Animated,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { memberService, schedulingService } from '@booking-app/firebase';
import type { Member, BlockedSlot, Service } from '@booking-app/shared';
import { ACTIVITY_CATEGORY_META } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import i18n from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import { useProvider } from '../../../contexts';
import { useProviderBookings, useServiceCategories, useServices } from '../../../hooks';
import {
  Text,
  Loader,
  DaySchedule,
  EmptyState,
  Avatar,
  CategorySelect,
  MemberSelect,
  ServicePickerModal,
  type DayScheduleBooking,
} from '../../../components';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'day' | 'week' | 'month';

// Status filter kept outside component to avoid new array on every render
const CALENDAR_STATUS_FILTER: ('pending' | 'confirmed')[] = ['pending', 'confirmed'];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const WEEK_HOUR_HEIGHT = 48;
const DEFAULT_WEEK_START_HOUR = 7;
const DEFAULT_WEEK_END_HOUR = 21;

// ---------------------------------------------------------------------------
// Locale-aware day/month names — derived from Intl on the app language
// (i18n.language) instead of hardcoded French arrays. Same Intl-only
// approach as lib/i18n.ts (no native module).
// ---------------------------------------------------------------------------

function dateLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR';
}

/** Narrow one-letter labels, Monday-first (FR: L M M J V S D). */
function getNarrowDayLabels(): string[] {
  const fmt = new Intl.DateTimeFormat(dateLocale(), { weekday: 'narrow' });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}

/** Long month name of the given date ("juillet" / "July"). */
function monthName(date: Date): string {
  return new Intl.DateTimeFormat(dateLocale(), { month: 'long' }).format(date);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function formatTime(date: Date): string {
  return (
    date.getHours().toString().padStart(2, '0') +
    ':' +
    date.getMinutes().toString().padStart(2, '0')
  );
}

/**
 * Cents → "120 €" / "89,50 €" — compact form for the small amount
 * badge on activity cards. Drops the cents when the amount is a
 * round euro so "12000" cents = "120 €" not "120,00 €".
 */
function formatActivityAmount(cents: number): string {
  const euros = cents / 100;
  if (euros % 1 === 0) return `${euros} €`;
  return `${euros.toFixed(2).replace('.', ',')} €`;
}

/**
 * Does two blocked slots' time windows intersect on the same day?
 * Used to detect stacked activities so we can show a disambiguation
 * sheet on tap instead of always opening whichever one happens to
 * be on top in z-order.
 *
 * Both slots must:
 *  - share at least one calendar day (they CAN span multiple days,
 *    we count them as overlapping if any day is shared)
 *  - have intersecting time ranges on that shared day. allDay
 *    counts as 00:00 → 23:59.
 */
function overlapsInTime(
  a: { startDate: Date; endDate: Date; allDay: boolean; startTime: string | null; endTime: string | null },
  b: { startDate: Date; endDate: Date; allDay: boolean; startTime: string | null; endTime: string | null },
): boolean {
  // Day-level overlap first.
  const aStartDay = new Date(a.startDate);
  aStartDay.setHours(0, 0, 0, 0);
  const aEndDay = new Date(a.endDate);
  aEndDay.setHours(0, 0, 0, 0);
  const bStartDay = new Date(b.startDate);
  bStartDay.setHours(0, 0, 0, 0);
  const bEndDay = new Date(b.endDate);
  bEndDay.setHours(0, 0, 0, 0);
  if (aEndDay < bStartDay || bEndDay < aStartDay) return false;

  // Time-level overlap. Convert both to minutes-from-midnight,
  // treating allDay or missing times as the full 0–1440 range.
  const minutesOf = (
    s: { allDay: boolean; startTime: string | null; endTime: string | null },
  ) => {
    if (s.allDay || !s.startTime || !s.endTime) return [0, 24 * 60] as const;
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    return [sh * 60 + sm, eh * 60 + em] as const;
  };
  const [aFrom, aTo] = minutesOf(a);
  const [bFrom, bTo] = minutesOf(b);
  return aFrom < bTo && bFrom < aTo;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatHeaderDate(date: Date): string {
  return capitalize(
    new Intl.DateTimeFormat(dateLocale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date),
  );
}

/**
 * Get the Monday of the week containing the given date.
 * Weeks start on Monday (ISO).
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Sunday = 0 -> offset = 6, Monday = 1 -> offset = 0, etc.
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the 7 days (Mon-Sun) of the week containing `monday`. The full
 * week is always loaded so that the visible window can pan
 * horizontally without triggering refetches.
 *
 * The visible width is 3.5 columns rather than a round number — the
 * half-column "peek" of the next day on the right edge is the
 * affordance that tells the pro the grid scrolls. Without it the
 * 4-column layout looks complete and pros miss days 5-7.
 */
const WEEK_VIEW_VISIBLE_DAYS = 3.5;

function getWeekDays(monday: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 1).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Compute overlap layout for bookings in a single day column.
 * Returns a map: bookingId → { column, totalColumns }
 * so each booking can be offset horizontally.
 */
function computeOverlapLayout(
  bookings: WeekBooking[],
  startHour: number,
): Record<string, { column: number; totalColumns: number }> {
  if (bookings.length <= 1) {
    const result: Record<string, { column: number; totalColumns: number }> = {};
    bookings.forEach((b) => { result[b.id] = { column: 0, totalColumns: 1 }; });
    return result;
  }

  // Sort by start time, then by duration (longer first)
  const sorted = [...bookings].sort((a, b) => {
    const aStart = a.datetime.getHours() * 60 + a.datetime.getMinutes();
    const bStart = b.datetime.getHours() * 60 + b.datetime.getMinutes();
    if (aStart !== bStart) return aStart - bStart;
    return b.duration - a.duration;
  });

  // Assign columns using a greedy algorithm
  const columns: { end: number; ids: string[] }[] = [];
  const assignment: Record<string, number> = {};

  for (const booking of sorted) {
    const bStart = booking.datetime.getHours() * 60 + booking.datetime.getMinutes();
    const bEnd = bStart + booking.duration;

    // Find the first column where this booking doesn't overlap
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (bStart >= columns[c].end) {
        columns[c].end = bEnd;
        columns[c].ids.push(booking.id);
        assignment[booking.id] = c;
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push({ end: bEnd, ids: [booking.id] });
      assignment[booking.id] = columns.length - 1;
    }
  }

  // Now compute the max overlapping columns for each group of overlapping bookings
  // For simplicity, use the total column count for each booking
  const result: Record<string, { column: number; totalColumns: number }> = {};
  const totalCols = columns.length;
  for (const booking of sorted) {
    result[booking.id] = { column: assignment[booking.id], totalColumns: totalCols };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const { colors, radius, shadows: themeShadows } = useTheme();
  const { t } = useTranslation();
  const idx = mode === 'day' ? 0 : mode === 'week' ? 1 : 2;
  const slideAnim = useRef(new Animated.Value(idx)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: idx,
      useNativeDriver: false,
      tension: 300,
      friction: 25,
    }).start();
  }, [idx, slideAnim]);

  const toggleWidth = 246;
  const pillWidth = toggleWidth / 3;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [2, pillWidth + 2, 2 * pillWidth + 2],
  });

  const item = (m: ViewMode, label: string) => (
    <Pressable
      onPress={() => onChange(m)}
      style={[styles.toggleButton, { width: pillWidth }]}
      hitSlop={4}
    >
      <Text
        variant="label"
        color={mode === m ? 'text' : 'textSecondary'}
        style={mode === m ? styles.toggleTextActive : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.toggleContainer,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.full,
          width: toggleWidth,
          height: 36,
        },
      ]}
    >
      {/* Animated pill indicator */}
      <Animated.View
        style={[
          styles.togglePill,
          {
            width: pillWidth - 4,
            backgroundColor: colors.surface,
            borderRadius: radius.full - 2,
            transform: [{ translateX }],
            ...themeShadows.sm,
          },
        ]}
      />

      {item('day', t('proCalendar.viewToggle.day'))}
      {item('week', t('proCalendar.viewToggle.week'))}
      {item('month', t('proCalendar.viewToggle.month'))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Month View Component (availability overview — mirrors the client calendar)
// ---------------------------------------------------------------------------

type MonthDayStatus = 'available' | 'almost_full' | 'full' | 'closed';

function monthDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface MonthCalendarProps {
  providerId: string;
  selectedDate: Date;
  services: WithId<Service>[];
  categories: { id: string; name: string }[];
  /** Team members. `memberId` picks one; null = aggregate across all of them. */
  members: WithId<Member>[];
  memberId: string | null;
  maxBookingAdvance: number;
  onDayPress: (date: Date) => void;
}

function MonthCalendar({
  providerId,
  selectedDate,
  services,
  categories,
  members,
  memberId,
  maxBookingAdvance,
  onDayPress,
}: MonthCalendarProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  // null = service-agnostic occupancy mode (just statuses).
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [durationOverride, setDurationOverride] = useState<number | undefined>(undefined);
  // null = default "Vue générale" label, resolved through t() at render
  // so it follows live language switches.
  const [selLabel, setSelLabel] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [summary, setSummary] = useState<
    Record<string, { status: MonthDayStatus; capacity?: number }>
  >({});
  const [loading, setLoading] = useState(false);

  const { gridStart, gridEnd, days } = useMemo(() => {
    const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const dow = first.getDay();
    const offset = dow === 0 ? 6 : dow - 1; // back to Monday
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    const arr = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const end = new Date(arr[41]);
    end.setHours(23, 59, 59, 999);
    return { gridStart: start, gridEnd: end, days: arr };
  }, [selectedDate]);

  useEffect(() => {
    if (!providerId) {
      setSummary({});
      return;
    }
    // A specific member → just them; null → aggregate across the whole team
    // (best status per day; capacities summed in service mode).
    const pool = members.filter((m) => m.isActive !== false);
    const effective = memberId
      ? pool.filter((m) => m.id === memberId)
      : pool.length > 0
        ? pool
        : members;
    if (effective.length === 0) {
      setSummary({});
      return;
    }
    let cancelled = false;
    const rank: Record<string, number> = { closed: 0, full: 1, almost_full: 2, available: 3 };
    (async () => {
      setLoading(true);
      try {
        const map: Record<string, { status: MonthDayStatus; capacity?: number }> = {};
        for (const mem of effective) {
          if (serviceId) {
            const ds = await schedulingService.getAvailabilitySummary({
              providerId,
              serviceId,
              memberId: mem.id,
              startDate: gridStart,
              endDate: gridEnd,
              durationOverride,
            });
            for (const d of ds) {
              const cur = map[d.date];
              if (!cur) {
                map[d.date] = { status: d.status, capacity: d.capacity };
              } else {
                cur.capacity = (cur.capacity ?? 0) + d.capacity;
                if ((rank[d.status] ?? 0) > (rank[cur.status] ?? 0)) cur.status = d.status;
              }
            }
          } else {
            const ds = await schedulingService.getOccupancySummary({
              providerId,
              memberId: mem.id,
              startDate: gridStart,
              endDate: gridEnd,
            });
            for (const d of ds) {
              const cur = map[d.date];
              if (!cur || (rank[d.status] ?? 0) > (rank[cur.status] ?? 0)) {
                map[d.date] = { status: d.status };
              }
            }
          }
        }
        if (!cancelled) setSummary(map);
      } catch (e) {
        if (!cancelled) console.error('[MonthCalendar]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, memberId, members, serviceId, durationOverride, gridStart.getTime(), gridEnd.getTime()]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + maxBookingAdvance);
  horizon.setHours(23, 59, 59, 999);
  const horizonLabel = horizon.toLocaleDateString(dateLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const gridBeyond = days[41] > horizon;
  const month = selectedDate.getMonth();
  const serviceMode = serviceId !== null;

  const DOT: Record<MonthDayStatus, string> = {
    available: '#10b981',
    almost_full: '#f59e0b',
    full: '#f43f5e',
    closed: colors.border,
  };
  const WEEK = getNarrowDayLabels();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] }}
    >
      {/* Service picker trigger (modal handles long prestation lists +
          variations/options far better than a cramped chip row). */}
      <Pressable
        onPress={() => setPickerOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginVertical: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 2,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Text variant="body" numberOfLines={1} style={{ flex: 1, color: colors.text }}>
          {selLabel ?? t('proCalendar.generalView')}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <ServicePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        services={services}
        categories={categories}
        currentServiceId={serviceId}
        onApply={(sid, dur, label) => {
          setServiceId(sid);
          setDurationOverride(dur);
          setSelLabel(label);
          setPickerOpen(false);
        }}
      />

      {/* Weekday headers */}
      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text variant="caption" color="textSecondary">
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={{ position: 'relative' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((d, i) => {
          const s = summary[monthDateKey(d)];
          const status: MonthDayStatus = s?.status ?? 'closed';
          const inMonth = d.getMonth() === month;
          const isPast = d < today;
          const isBeyond = d > horizon;
          const isToday = d.getTime() === today.getTime();
          const pressable =
            !isPast && !isBeyond && (status === 'available' || status === 'almost_full');
          return (
            <Pressable
              key={i}
              disabled={!pressable}
              onPress={() => pressable && onDayPress(d)}
              style={{
                width: `${100 / 7}%`,
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !inMonth || isPast || isBeyond ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday ? colors.primary : 'transparent',
                }}
              >
                <Text
                  variant="caption"
                  style={{ fontWeight: isToday ? '700' : '500', color: isToday ? '#FFFFFF' : colors.text }}
                >
                  {d.getDate()}
                </Text>
              </View>
              {isBeyond ? (
                <Ionicons name="lock-closed" size={10} color={colors.border} style={{ marginTop: 3 }} />
              ) : s && !isPast ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, minHeight: 14 }}
                >
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: DOT[status] }} />
                  {serviceMode &&
                    typeof s.capacity === 'number' &&
                    (status === 'available' || status === 'almost_full') && (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                        {s.capacity}
                      </Text>
                    )}
                </View>
              ) : (
                <View style={{ minHeight: 14, marginTop: 3 }} />
              )}
            </Pressable>
          );
        })}
        </View>
        {loading && (
          <>
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colors.background,
                opacity: 0.55,
                borderRadius: radius.md,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          </>
        )}
      </View>

      {/* Booking-horizon notice */}
      {gridBeyond && (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceSecondary,
          }}
        >
          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} style={{ marginTop: 1 }} />
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
            {t('proCalendar.horizonNotice', { date: horizonLabel, days: maxBookingAdvance })}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md }}>
        {([
          ['#10b981', t('proCalendar.legend.available')],
          ['#f59e0b', serviceMode ? t('proCalendar.legend.almostFull') : t('proCalendar.legend.busy')],
          ['#f43f5e', t('proCalendar.legend.full')],
          [colors.border, t('proCalendar.legend.closed')],
        ] as [string, string][]).map(([c, l], i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />
            <Text variant="caption" color="textSecondary">
              {l}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Week View Component
// ---------------------------------------------------------------------------

interface WeekBooking {
  id: string;
  datetime: Date;
  duration: number;
  clientName: string;
  serviceName: string;
  status: string;
  memberId: string | null;
  memberName: string | null;
  memberColor: string | null;
  /** Resolved color for the cell tint+border. Service color first, then
   *  member color, then null (status-driven fallback in the renderer). */
  displayColor: string | null;
}

interface WeekBlockedSlotMember {
  name: string;
  color: string | null;
}

interface WeekBlockedSlot {
  id: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  memberName: string | null;
  memberColor: string | null;
  members: WeekBlockedSlotMember[];
  isAllMembers: boolean;
  /** Activity flavour — when set, the week-view renderer treats this
   *  as a foreground card with the category color and `title` instead
   *  of the dim grey "blocked period" background slab. */
  category?: import('@booking-app/shared').ActivityCategory | null;
  categoryColor?: string | null;
  title?: string | null;
  /** Amount earned for this activity, in cents. Optional — only set
   *  for paid activities. Drives the small `120 €` badge on the
   *  card. */
  amount?: number | null;
}

interface WeekViewProps {
  weekDays: Date[];
  selectedDate: Date;
  bookings: WeekBooking[];
  blockedSlots?: WeekBlockedSlot[];
  onDayPress: (date: Date) => void;
  onBookingPress: (id: string) => void;
  /** Triggered when the user taps an activity card (a blocked slot
   *  with a category + title). Only activities are tappable from
   *  week view — plain blocked periods stay as background slabs.
   *  Without this, the tap falls through to the day cell and
   *  zooms to day view, which forces a 2-step interaction.
   *  See user feedback 2026-05-08. */
  onActivityPress?: (id: string) => void;
  onDisambiguate?: (bookings: WeekBooking[]) => void;
  showMemberAvatars: boolean;
  startHour?: number;
  endHour?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Triggered when the user swipes horizontally across the grid —
   *  -1 = window goes back in time, +1 = window goes forward. */
  onNavigate?: (direction: -1 | 1) => void;
}

function WeekView({
  weekDays,
  selectedDate,
  bookings,
  blockedSlots = [],
  onDayPress,
  onBookingPress,
  onActivityPress,
  onDisambiguate,
  showMemberAvatars,
  startHour = DEFAULT_WEEK_START_HOUR,
  endHour = DEFAULT_WEEK_END_HOUR,
  refreshing = false,
  onRefresh,
  onNavigate,
}: WeekViewProps) {
  const { colors, spacing, radius } = useTheme();
  const { t, i18n: i18nInstance } = useTranslation();
  // Narrow Monday-first day letters — re-derived when the language changes.
  const dayLabels = useMemo(() => getNarrowDayLabels(), [i18nInstance.language]);

  const weekTotalHours = endHour - startHour;
  const timeColumnWidth = 44;
  const availableWidth = SCREEN_WIDTH - spacing.lg * 2 - timeColumnWidth;
  // Each column takes 1/4 of the visible width — so the 7 columns span
  // 1.75× the viewport and the user has to scroll horizontally to see
  // the rest. This gives breathing room for booking content while
  // keeping the full week loaded (no refetch on swipe).
  const columnWidth = availableWidth / WEEK_VIEW_VISIBLE_DAYS;
  const gridWidth = columnWidth * weekDays.length;
  const totalHeight = weekTotalHours * WEEK_HOUR_HEIGHT;

  // Group bookings by day index (0 = Monday)
  const bookingsByDay = useMemo(() => {
    const map: Record<number, WeekBooking[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];

    bookings.forEach((b) => {
      const dt =
        b.datetime instanceof Date
          ? b.datetime
          : (b.datetime as any).toDate();
      const dayIdx = weekDays.findIndex((wd) => isSameDay(wd, dt));
      if (dayIdx >= 0) {
        map[dayIdx].push({ ...b, datetime: dt });
      }
    });
    return map;
  }, [bookings, weekDays]);

  // Group blocked slots by day index
  const blockedByDay = useMemo(() => {
    const map: Record<number, WeekBlockedSlot[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];

    blockedSlots.forEach((bs) => {
      weekDays.forEach((wd, dayIdx) => {
        const dayStart = startOfDay(wd);
        const dayEnd = endOfDay(wd);
        if (bs.startDate <= dayEnd && bs.endDate >= dayStart) {
          map[dayIdx].push(bs);
        }
      });
    });
    return map;
  }, [blockedSlots, weekDays]);

  // Current time position
  const nowLine = useMemo(() => {
    const now = new Date();
    const todayIdx = weekDays.findIndex((wd) => isSameDay(wd, now));
    if (todayIdx < 0) return null;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMin = startHour * 60;
    const endMin = endHour * 60;
    if (nowMinutes < startMin || nowMinutes > endMin) return null;

    const top = ((nowMinutes - startMin) / (endMin - startMin)) * totalHeight;
    return { top, dayIdx: todayIdx };
  }, [weekDays, totalHeight, startHour, endHour]);

  /** Convert hex color to light tint (20% opacity equivalent).
   *  Defensive: anything that isn't a #rrggbb string (empty string,
   *  named color, malformed value from a denormalised doc) falls back
   *  to a neutral surface instead of producing rgb(NaN,…) — invalid
   *  color strings hard-crash the native style parser in release. */
  function getLightTint(hex: string): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return colors.surfaceSecondary;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const blend = (c: number) => Math.round(c * 0.2 + 255 * 0.8);
    return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
  }

  function getStatusBarColor(status: string): string {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'cancelled':
        return colors.textMuted;
      default:
        return colors.border;
    }
  }

  function getStatusBgColor(status: string): string {
    switch (status) {
      case 'confirmed':
        return colors.successLight;
      case 'pending':
        return colors.warningLight;
      case 'cancelled':
        return colors.surfaceSecondary;
      default:
        return colors.surfaceSecondary;
    }
  }

  // Generate hour labels
  const hours = useMemo(() => {
    const result: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      // Handle hour 24 as "00:00" (midnight end)
      const displayHour = h === 24 ? 0 : h;
      result.push(`${displayHour.toString().padStart(2, '0')}:00`);
    }
    return result;
  }, [startHour, endHour]);

  // Refs for syncing the horizontal scroll between the header row
  // and the body grid. Only the body is touch-scrollable; the header
  // mirrors its offset so day-of-week labels stay aligned with the
  // hour grid below as the user pans through the 7-day window.
  const headerScrollRef = React.useRef<ScrollView>(null);
  const bodyHorizontalScrollRef = React.useRef<ScrollView>(null);
  const handleBodyHorizontalScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      headerScrollRef.current?.scrollTo({
        x: e.nativeEvent.contentOffset.x,
        animated: false,
      });
    },
    [],
  );
  // Center the initial offset around today (or selectedDate when not
  // today): we put the targeted day at index 1 of the visible 4 (so
  // there's always one day of context before it).
  const initialHorizontalOffset = useMemo(() => {
    const targetIdx = weekDays.findIndex((d) => isSameDay(d, selectedDate));
    if (targetIdx < 0) return 0;
    const desired = targetIdx - 1; // place selectedDate at visible col 1
    const maxLeft = Math.max(0, weekDays.length - WEEK_VIEW_VISIBLE_DAYS);
    const clamped = Math.max(0, Math.min(desired, maxLeft));
    return clamped * columnWidth;
  }, [weekDays, selectedDate, columnWidth]);

  // Apply the initial scroll position imperatively, *not* via the
  // ScrollView's `contentOffset` prop. The prop is re-applied every
  // render with a new object reference, which jolts the user back
  // to col 1 every time the calendar refreshes (e.g. when returning
  // from /create-activity). Using scrollTo keyed off the actual
  // numeric offset value means we only scroll when selectedDate
  // genuinely changes — render-cycle refreshes are no-ops, the
  // user's manual scroll position is preserved.
  const lastAppliedOffsetRef = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    if (lastAppliedOffsetRef.current === initialHorizontalOffset) return;
    lastAppliedOffsetRef.current = initialHorizontalOffset;
    bodyHorizontalScrollRef.current?.scrollTo({
      x: initialHorizontalOffset,
      y: 0,
      animated: false,
    });
    // Keep the header in sync with the body's new offset.
    headerScrollRef.current?.scrollTo({
      x: initialHorizontalOffset,
      y: 0,
      animated: false,
    });
  }, [initialHorizontalOffset]);

  return (
    <View style={{ flex: 1 }}>
      {/* Column headers — horizontally scrollable, mirrors body scroll */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        }}
      >
        <View style={{ width: timeColumnWidth }} />
        <ScrollView
          ref={headerScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={{ width: gridWidth }}
        >
          <View style={[styles.weekHeaderRow, { width: gridWidth }]}>
        {weekDays.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <Pressable
              key={idx}
              onPress={() => onDayPress(day)}
              style={[
                styles.weekHeaderCell,
                {
                  width: columnWidth,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.lg,
                  backgroundColor: isSelected
                    ? colors.primaryLight
                    : 'transparent',
                },
              ]}
            >
              <Text
                variant="caption"
                color={isSelected ? 'primary' : 'textMuted'}
                style={styles.weekDayLabel}
              >
                {dayLabels[idx]}
              </Text>
              <View
                style={[
                  styles.weekDateCircle,
                  {
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isTodayDate
                      ? colors.primary
                      : 'transparent',
                  },
                ]}
              >
                <Text
                  variant="label"
                  color={
                    isTodayDate
                      ? 'textInverse'
                      : isSelected
                        ? 'primary'
                        : 'text'
                  }
                  style={{ fontSize: 13 }}
                >
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
          </View>
        </ScrollView>
      </View>

      {/* Scrollable grid */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['4xl'] }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        <View
          style={[
            styles.weekGrid,
            {
              height: totalHeight,
              paddingHorizontal: spacing.lg,
            },
          ]}
        >
          {/* Time column */}
          <View style={{ width: timeColumnWidth, position: 'relative' }}>
            {hours.map((hour, idx) => (
              <View
                key={hour}
                style={[
                  styles.weekTimeLabel,
                  { top: idx * WEEK_HOUR_HEIGHT - 7 },
                ]}
              >
                <Text
                  variant="caption"
                  color="textMuted"
                  style={{ fontSize: 10 }}
                >
                  {hour}
                </Text>
              </View>
            ))}
          </View>

          {/* Day columns — horizontally scrollable so the 7 columns
              span 1.75× the viewport (4 visible) and the user pans
              through. Header above mirrors this scroll position. */}
          <ScrollView
            ref={bodyHorizontalScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleBodyHorizontalScroll}
            // Initial scroll position is set imperatively via the
            // useLayoutEffect above so refreshes don't jolt the
            // user back to col 1.
            style={{ flex: 1 }}
          >
          <View style={{ width: gridWidth, flexDirection: 'row', position: 'relative' }}>
            {/* Hour grid lines */}
            {hours.map((_, idx) => (
              <View
                key={`line-${idx}`}
                style={[
                  styles.weekGridLine,
                  {
                    top: idx * WEEK_HOUR_HEIGHT,
                    backgroundColor: colors.divider,
                  },
                ]}
              />
            ))}

            {/* Day columns with bookings and blocked slots */}
            {weekDays.map((day, dayIdx) => {
              const isSelected = isSameDay(day, selectedDate);
              const dayBookings = bookingsByDay[dayIdx] || [];
              const dayBlocked = blockedByDay[dayIdx] || [];

              return (
                <Pressable
                  key={dayIdx}
                  onPress={() => onDayPress(day)}
                  style={[
                    styles.weekDayColumn,
                    {
                      width: columnWidth,
                      height: totalHeight,
                      borderRightWidth:
                        dayIdx < 6 ? StyleSheet.hairlineWidth : 0,
                      borderRightColor: colors.divider,
                      backgroundColor: isSelected
                        ? colors.primaryLight + '40'
                        : 'transparent',
                    },
                  ]}
                >
                  {/* Blocked slots / activities */}
                  {dayBlocked.map((bs) => {
                    let bsStartMin: number;
                    let bsEndMin: number;
                    if (bs.allDay) {
                      bsStartMin = startHour * 60;
                      bsEndMin = endHour * 60;
                    } else {
                      const [sh, sm] = (bs.startTime || '00:00').split(':').map(Number);
                      const [eh, em] = (bs.endTime || '23:59').split(':').map(Number);
                      bsStartMin = sh * 60 + sm;
                      bsEndMin = eh * 60 + em;
                    }
                    const clampStart = Math.max(bsStartMin - startHour * 60, 0);
                    const clampEnd = Math.min(bsEndMin - startHour * 60, weekTotalHours * 60);
                    if (clampEnd <= clampStart) return null;
                    const bsTop = (clampStart / (weekTotalHours * 60)) * totalHeight;
                    const bsHeight = ((clampEnd - clampStart) / (weekTotalHours * 60)) * totalHeight;

                    const isActivity = !!bs.category && !!bs.title;
                    if (isActivity) {
                      // Activity = foreground card with FULL category
                      // color + white text. Solid fill (no transparency)
                      // so the activity reads as a real event rather
                      // than a faded blocking zone.
                      // Wrapped in Pressable so the tap goes straight
                      // to the activity detail screen instead of
                      // falling through to the day cell (which would
                      // zoom to day view and require a second tap).
                      const accent = bs.categoryColor || colors.textMuted;
                      return (
                        <Pressable
                          key={`activity-${bs.id}-${dayIdx}`}
                          onPress={() => onActivityPress?.(bs.id)}
                          style={({ pressed }) => [
                            styles.weekBlockedBar,
                            {
                              top: bsTop,
                              height: Math.max(bsHeight, 8),
                              backgroundColor: accent,
                              borderRadius: radius.sm,
                              marginHorizontal: 1,
                              paddingHorizontal: 3,
                              paddingVertical: 1,
                              opacity: pressed ? 0.75 : 1,
                            },
                          ]}
                        >
                          {bsHeight > 12 && (
                            <Text
                              variant="caption"
                              numberOfLines={1}
                              style={{
                                fontSize: 8,
                                lineHeight: 10,
                                fontWeight: '700',
                                color: '#FFFFFF',
                              }}
                            >
                              {bs.title}
                            </Text>
                          )}
                          {bsHeight > 24 && bs.reason && (
                            <Text
                              variant="caption"
                              numberOfLines={1}
                              style={{
                                fontSize: 7,
                                lineHeight: 9,
                                color: 'rgba(255,255,255,0.85)',
                              }}
                            >
                              {bs.reason}
                            </Text>
                          )}
                          {/* Amount badge — bottom-right corner of
                              the card. Hidden when the card is
                              tiny (< 18px tall) to avoid clipping. */}
                          {bs.amount != null && bs.amount > 0 && bsHeight > 18 && (
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 1,
                                right: 1,
                                backgroundColor: 'rgba(255,255,255,0.22)',
                                paddingHorizontal: 4,
                                paddingVertical: 0,
                                borderRadius: 3,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 8,
                                  lineHeight: 10,
                                  fontWeight: '700',
                                  color: '#FFFFFF',
                                }}
                                numberOfLines={1}
                              >
                                {formatActivityAmount(bs.amount)}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    }

                    // Plain blocked period (vacation, training…) keeps
                    // the original "background" look — dashed border,
                    // grey or member-color tint, "Bloqué" label.
                    const primaryColor = bs.members.length === 1 ? bs.members[0].color : null;
                    const bsBarColor = primaryColor || colors.textMuted;
                    const bsBgColor = primaryColor ? primaryColor + '15' : colors.surfaceSecondary;
                    return (
                      <View
                        key={`blocked-${bs.id}-${dayIdx}`}
                        style={[
                          styles.weekBlockedBar,
                          {
                            top: bsTop,
                            height: Math.max(bsHeight, 6),
                            backgroundColor: bsBgColor,
                            borderLeftWidth: 2,
                            borderLeftColor: bsBarColor,
                            borderRadius: radius.sm,
                            marginHorizontal: 1,
                            borderStyle: 'dashed',
                          },
                        ]}
                      >
                        {bsHeight > 12 && (
                          <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{ fontSize: 7, lineHeight: 9, fontWeight: '600', color: bsBarColor }}
                          >
                            {bs.reason || t('proCalendar.blocked')}
                          </Text>
                        )}
                        {bsHeight > 20 && bs.members.length > 1 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 1 }}>
                            {bs.isAllMembers ? (
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
                            ) : (
                              bs.members.slice(0, 3).map((m, i) => (
                                <View
                                  key={i}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: 3,
                                    backgroundColor: m.color || colors.textMuted,
                                  }}
                                />
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {(() => {
                    const overlapLayout = computeOverlapLayout(dayBookings, startHour);
                    return dayBookings.map((booking) => {
                    const dt = booking.datetime;
                    const startMin =
                      dt.getHours() * 60 + dt.getMinutes();
                    const bookingStartOffset =
                      startMin - startHour * 60;
                    const top =
                      (bookingStartOffset /
                        (weekTotalHours * 60)) *
                      totalHeight;
                    const height = Math.max(
                      (booking.duration /
                        (weekTotalHours * 60)) *
                        totalHeight,
                      8,
                    );

                    const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
                    const memberInitials = booking.memberName
                      ? getInitials(booking.memberName)
                      : null;

                    const layout = overlapLayout[booking.id] || { column: 0, totalColumns: 1 };
                    const colWidth = (columnWidth - 2) / layout.totalColumns;
                    const colLeft = layout.column * colWidth;

                    return (
                      <Pressable
                        key={booking.id}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          // When 3+ bookings overlap and columns are very narrow, show disambiguation
                          if (layout.totalColumns >= 3 && onDisambiguate) {
                            const overlapping = dayBookings.filter((b) => {
                              const bLayout = overlapLayout[b.id];
                              return bLayout && bLayout.totalColumns >= 3;
                            });
                            onDisambiguate(overlapping);
                          } else {
                            onBookingPress(booking.id);
                          }
                        }}
                        style={[
                          styles.weekBookingBar,
                          {
                            top,
                            height,
                            left: colLeft,
                            right: undefined,
                            width: colWidth,
                            backgroundColor: booking.displayColor
                              ? getLightTint(booking.displayColor)
                              : getStatusBgColor(booking.status),
                            borderLeftWidth: 2,
                            borderLeftColor: booking.displayColor || getStatusBarColor(
                              booking.status,
                            ),
                            borderRadius: radius.sm,
                            paddingHorizontal: 2,
                            paddingVertical: 1,
                            // Adaptive layout: short cells (typical for
                            // 30-min slots) lay time + client name on the
                            // SAME LINE so the user actually sees the
                            // client; taller cells stack vertically.
                            flexDirection: height < 30 ? 'row' : 'column',
                            alignItems: height < 30 ? 'center' : 'stretch',
                            gap: height < 30 ? 4 : 0,
                            // NB: never set `position` here — `styles.weekBookingBar`
                            // already declares `position: 'absolute'`, and an inline
                            // override (e.g. 'relative') makes the bar fall back to
                            // normal flow, so back-to-back 30-min bookings end up
                            // stacked on top of each other instead of side-by-side
                            // on the timeline. The absolute parent is itself the
                            // positioning context for the member-dot child below.
                          },
                        ]}
                      >
                        {/* Member dot — only when multi-member AND a
                            distinct member color exists. Top-right corner
                            so it never collides with the text. */}
                        {showMemberAvatars && booking.memberColor && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: booking.memberColor,
                            }}
                          />
                        )}
                        {/* Time — always shown if block is tall enough */}
                        {height > 12 && (
                          <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{
                              fontSize: 8,
                              fontWeight: '500',
                              lineHeight: 10,
                            }}
                            color="textMuted"
                          >
                            {timeStr}
                          </Text>
                        )}
                        {/* Client name — always shown when block is tall
                            enough to fit a single line of text. In the
                            short-cell horizontal layout this sits next to
                            the time on the same line. */}
                        {height > 12 && (
                          <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{
                              fontSize: 9,
                              fontWeight: '600',
                              lineHeight: 11,
                              flexShrink: 1,
                              flex: height < 30 ? 1 : undefined,
                            }}
                            color="text"
                          >
                            {booking.clientName.split(' ')[0]}
                          </Text>
                        )}
                        {/* Service name — only on tall cells */}
                        {height >= 34 && (
                          <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{
                              fontSize: 8,
                              lineHeight: 10,
                            }}
                            color="textSecondary"
                          >
                            {booking.serviceName}
                          </Text>
                        )}
                        {/* Member avatar — only if multi-members */}
                        {showMemberAvatars && memberInitials && height > 46 && (
                          <View
                            style={[
                              styles.weekBookingAvatar,
                              {
                                backgroundColor: booking.memberColor || getStatusBarColor(booking.status),
                                borderRadius: 7,
                              },
                            ]}
                          >
                            <Text
                              variant="caption"
                              style={{
                                fontSize: 7,
                                fontWeight: '700',
                                color: '#FFFFFF',
                                lineHeight: 9,
                              }}
                            >
                              {memberInitials}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  });
                  })()}
                </Pressable>
              );
            })}

            {/* Now line for week view */}
            {nowLine && (
              <View
                style={[
                  styles.weekNowLine,
                  {
                    top: nowLine.top,
                    left: nowLine.dayIdx * columnWidth,
                    width: columnWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.weekNowDot,
                    { backgroundColor: colors.error },
                  ]}
                />
                <View
                  style={[
                    styles.weekNowLineLine,
                    { backgroundColor: colors.error },
                  ]}
                />
              </View>
            )}
          </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CalendarScreen() {
  const { colors, spacing, radius, shadows: themeShadows } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { providerId, provider } = useProvider();
  const { memberId: memberIdParam, action: actionParam } =
    useLocalSearchParams<{ memberId?: string; action?: string }>();

  // Honor `?action=add` (set by the centre + tab button) — open the
  // unified add sheet on focus, then clear the param so subsequent
  // navigations to this tab don't re-trigger it.
  useEffect(() => {
    if (actionParam === 'add') {
      setShowAddSheet(true);
      router.setParams({ action: undefined } as any);
    }
  }, [actionParam, router]);

  // ---- State ----
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(memberIdParam ?? null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [disambiguationBookings, setDisambiguationBookings] = useState<WeekBooking[] | null>(null);
  // Same idea for stacked activities — a tap on an overlapping
  // group opens a sheet so the pro can pick which one to open.
  // Without this they get whichever one is on top in z-order.
  const [disambiguationActivities, setDisambiguationActivities] =
    useState<WithId<BlockedSlot>[] | null>(null);
  // Bottom sheet for the unified "+ ajouter" action — three flavours:
  // client booking, personal activity, blocked period.
  const [showAddSheet, setShowAddSheet] = useState(false);

  // ---- Date range for the selected day ----
  const dayStart = useMemo(() => startOfDay(selectedDate), [selectedDate]);
  const dayEnd = useMemo(() => endOfDay(selectedDate), [selectedDate]);

  // ---- Week data ─ load full 7 days; visible window is 4 (see WeekView)
  const weekMonday = useMemo(() => getMonday(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getWeekDays(weekMonday), [weekMonday]);
  const weekStart = useMemo(() => startOfDay(weekDays[0]), [weekDays]);
  const weekEnd = useMemo(() => endOfDay(weekDays[6]), [weekDays]);

  // ---- Fetch bookings ----
  // In day mode, fetch for the day. In week mode, fetch for the entire week.
  const fetchStart = viewMode === 'week' ? weekStart : dayStart;
  const fetchEnd = viewMode === 'week' ? weekEnd : dayEnd;

  const { bookings, isLoading, refresh } = useProviderBookings({
    providerId,
    startDate: fetchStart,
    endDate: fetchEnd,
    memberId: selectedMemberId ?? undefined,
    status: CALENDAR_STATUS_FILTER,
  });

  // ---- Load members on mount ----
  useEffect(() => {
    if (!providerId) return;
    memberService
      .getByProvider(providerId)
      .then((result) => {
        setMembers((result as WithId<Member>[]).filter((m) => m.isActive));
      })
      .catch(() => setMembers([]));
  }, [providerId]);

  // ---- Apply memberId from route params (e.g. navigating from Members screen) ----
  useEffect(() => {
    if (memberIdParam) {
      setSelectedMemberId(memberIdParam);
    }
  }, [memberIdParam]);

  // ---- Live blocked slots for the current range ----
  // Real-time Firestore subscription — any add / edit / delete (from
  // /create-activity, /block-slot, or even another device) reflects
  // here immediately. No pull-to-refresh required.
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);
  useEffect(() => {
    if (!providerId) return;
    const unsub = schedulingService.subscribeToBlockedSlotsInRange(
      providerId,
      fetchStart,
      fetchEnd,
      setBlockedSlots,
      () => setBlockedSlots([]),
    );
    return unsub;
  }, [providerId, fetchStart, fetchEnd]);

  // ---- Whether to show the member filter ----
  const showMemberFilter = members.length > 1;

  // ---- Member name map for blocked slots ----
  const memberNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) map[m.id] = m.name;
    return map;
  }, [members]);

  const memberColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members) {
      if (m.color) map[m.id] = m.color;
    }
    return map;
  }, [members]);

  // ---- Category filtering ----
  const { categories } = useServiceCategories(providerId ?? undefined);
  const { services } = useServices(providerId ?? undefined);

  const serviceCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    services.forEach((s) => {
      if (s.categoryId) map[s.id] = s.categoryId;
    });
    return map;
  }, [services]);

  // Live service color lookup — needed because `booking.serviceColor`
  // is denormalised at creation time, so any booking created BEFORE
  // the pro configured colors (or before we shipped the feature) has
  // a null serviceColor. Resolving from the live service catalog at
  // render time means existing bookings pick up colors as soon as
  // the pro sets them.
  const serviceColorMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    services.forEach((s) => {
      map[s.id] = s.color ?? null;
    });
    return map;
  }, [services]);

  const filteredBookings = useMemo(() => {
    if (!selectedCategoryId) return bookings;
    return bookings.filter((b) => serviceCategoryMap[b.serviceId] === selectedCategoryId);
  }, [bookings, selectedCategoryId, serviceCategoryMap]);

  // ---- Blocked slots for the selected day (grouped by same time + reason) ----
  const dayBlockedSlots = useMemo(() => {
    if (viewMode !== 'day') return [];
    const filtered = blockedSlots.filter((bs) => {
      if (selectedMemberId && bs.memberId !== selectedMemberId) return false;
      const bsStart = bs.startDate instanceof Date ? bs.startDate : (bs.startDate as any).toDate();
      const bsEnd = bs.endDate instanceof Date ? bs.endDate : (bs.endDate as any).toDate();
      return bsStart <= dayEnd && bsEnd >= dayStart;
    });

    // Group by same start/end/allDay/reason
    const groups: Record<string, { ids: string[]; bs: typeof filtered[0]; members: { name: string; color: string | null }[] }> = {};
    for (const bs of filtered) {
      const bsStart = bs.startDate instanceof Date ? bs.startDate : (bs.startDate as any).toDate();
      const bsEnd = bs.endDate instanceof Date ? bs.endDate : (bs.endDate as any).toDate();
      const startTime = bs.allDay ? '00:00' : (bs.startTime || formatTime(bsStart));
      const endTime = bs.allDay ? '23:59' : (bs.endTime || formatTime(bsEnd));
      // Activity flavour: include category + title in the grouping key
      // so two activities with the same time but different titles
      // don't end up merged. Regular blocked periods (no category)
      // continue to group across members like before.
      const activityKey = bs.category ? `${bs.category}|${bs.title || ''}` : '';
      const key = `${startTime}-${endTime}-${bs.allDay}-${bs.reason || ''}-${activityKey}`;
      if (!groups[key]) {
        groups[key] = { ids: [], bs, members: [] };
      }
      groups[key].ids.push(bs.id);
      groups[key].members.push({
        name: memberNameMap[bs.memberId] || t('proCalendar.memberFallback'),
        color: memberColorMap[bs.memberId] || null,
      });
    }

    const activeMembers = members.filter((m) => m.isActive !== false);
    return Object.values(groups).map((g) => {
      const bsStart = g.bs.startDate instanceof Date ? g.bs.startDate : (g.bs.startDate as any).toDate();
      const bsEnd = g.bs.endDate instanceof Date ? g.bs.endDate : (g.bs.endDate as any).toDate();
      const isAllMembers = activeMembers.length > 1 && g.members.length >= activeMembers.length;
      const categoryColor = g.bs.category
        ? ACTIVITY_CATEGORY_META[g.bs.category]?.color ?? null
        : null;
      return {
        id: g.ids.join('-'),
        startTime: g.bs.allDay ? '00:00' : (g.bs.startTime || formatTime(bsStart)),
        endTime: g.bs.allDay ? '23:59' : (g.bs.endTime || formatTime(bsEnd)),
        reason: g.bs.reason,
        memberName: g.members[0]?.name || null,
        memberColor: g.members[0]?.color || null,
        members: g.members,
        isAllMembers,
        allDay: g.bs.allDay,
        category: g.bs.category ?? null,
        categoryColor,
        title: g.bs.title ?? null,
        address: g.bs.address ?? null,
        amount: g.bs.amount ?? null,
      };
    });
  }, [blockedSlots, viewMode, selectedMemberId, dayStart, dayEnd, memberNameMap, memberColorMap, members, t]);

  // ---- Transform bookings for Day View ----
  const dayBookings: DayScheduleBooking[] = useMemo(() => {
    if (viewMode !== 'day') return [];
    return filteredBookings.map((b) => {
      const dt =
        b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate();
      const endDt = addMinutes(dt, b.duration);
      const memberColor =
        (b.memberId && memberColorMap[b.memberId]) || b.memberColor || null;
      // Live catalog lookup — see weekBookings comment.
      const serviceColor =
        serviceColorMap[b.serviceId] ?? b.serviceColor ?? null;
      return {
        id: b.id,
        startTime: formatTime(dt),
        endTime: formatTime(endDt),
        clientName: b.clientInfo?.name ?? t('proCalendar.clientFallback'),
        serviceName: b.serviceName,
        status: b.status,
        memberName: (b.memberId && memberNameMap[b.memberId]) || undefined,
        memberColor,
        // Service color tints the row; member color survives as the dot.
        displayColor: serviceColor || memberColor,
      };
    });
  }, [filteredBookings, viewMode, memberNameMap, memberColorMap, serviceColorMap, t]);

  // ---- Transform bookings for Week View ----
  const weekBookings: WeekBooking[] = useMemo(() => {
    if (viewMode !== 'week') return [];
    return filteredBookings.map((b) => {
      const dt =
        b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate();
      const memberColor =
        (b.memberId && memberColorMap[b.memberId]) || b.memberColor || null;
      // Resolve service color: prefer live catalog (so colors update
      // retroactively for old bookings), fall back to the value
      // denormalised on the booking doc.
      const serviceColor =
        serviceColorMap[b.serviceId] ?? b.serviceColor ?? null;
      return {
        id: b.id,
        datetime: dt,
        duration: b.duration,
        clientName: b.clientInfo?.name ?? t('proCalendar.clientFallback'),
        serviceName: b.serviceName,
        status: b.status,
        memberId: b.memberId ?? null,
        memberName: b.memberName ?? null,
        memberColor,
        // Service color wins over member color when set — see the
        // calendar-color hierarchy plan: "service color = WHAT, member
        // color = WHO". Member color is still surfaced via the dot.
        displayColor: serviceColor || memberColor,
      };
    });
  }, [filteredBookings, viewMode, memberColorMap, serviceColorMap, t]);

  // ---- Blocked slots for week view (grouped by same time + reason) ----
  const weekBlockedSlots = useMemo(() => {
    if (viewMode !== 'week') return [];
    const filtered = blockedSlots.filter((bs) => !selectedMemberId || bs.memberId === selectedMemberId);

    // Group by same start/end timestamps + allDay + reason. Activities
    // are NOT grouped across members (their title makes the key unique
    // per row), which keeps each personal activity addressable.
    const groups: Record<string, { slots: typeof filtered; members: WeekBlockedSlotMember[] }> = {};
    for (const bs of filtered) {
      const bsStart = bs.startDate instanceof Date ? bs.startDate : (bs.startDate as any).toDate();
      const bsEnd = bs.endDate instanceof Date ? bs.endDate : (bs.endDate as any).toDate();
      const activityKey = bs.category ? `${bs.category}|${bs.title || ''}` : '';
      const key = `${bsStart.getTime()}-${bsEnd.getTime()}-${bs.allDay}-${bs.reason || ''}-${activityKey}`;
      if (!groups[key]) {
        groups[key] = { slots: [], members: [] };
      }
      groups[key].slots.push(bs);
      groups[key].members.push({
        name: memberNameMap[bs.memberId] || t('proCalendar.memberFallback'),
        color: memberColorMap[bs.memberId] || null,
      });
    }

    const activeMembers = members.filter((m) => m.isActive !== false);
    return Object.values(groups).map((g) => {
      const bs = g.slots[0];
      const bsStart = bs.startDate instanceof Date ? bs.startDate : (bs.startDate as any).toDate();
      const bsEnd = bs.endDate instanceof Date ? bs.endDate : (bs.endDate as any).toDate();
      const isAllMembers = activeMembers.length > 1 && g.members.length >= activeMembers.length;
      const categoryColor = bs.category
        ? ACTIVITY_CATEGORY_META[bs.category]?.color ?? null
        : null;
      return {
        id: g.slots.map((s) => s.id).join('-'),
        startDate: bsStart,
        endDate: bsEnd,
        allDay: bs.allDay,
        startTime: bs.startTime,
        endTime: bs.endTime,
        reason: bs.reason,
        memberName: g.members[0]?.name || null,
        memberColor: g.members[0]?.color || null,
        members: g.members,
        isAllMembers,
        category: bs.category ?? null,
        categoryColor,
        title: bs.title ?? null,
        amount: bs.amount ?? null,
      };
    });
  }, [blockedSlots, viewMode, selectedMemberId, memberNameMap, memberColorMap, members, t]);

  // ---- Compute effective hour range from bookings + activities ----
  // Walks both data sources so an activity / categorised blocked
  // slot ending at 22:30 still gets its row painted instead of
  // being clipped at the default 21:00 cap. allDay vacations are
  // intentionally skipped — they cover 00→24 conceptually but
  // shouldn't expand the visible grid to the full day.
  const { effectiveStartHour, effectiveEndHour } = useMemo(() => {
    let minHour = DEFAULT_WEEK_START_HOUR;
    let maxHour = DEFAULT_WEEK_END_HOUR;

    for (const b of bookings) {
      const dt =
        b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate();
      const bStartHour = dt.getHours();
      const endDt = addMinutes(dt, b.duration);
      // If the booking ends at or past midnight next day, cap at 24
      let bEndHour = endDt.getHours() === 0 && endDt.getMinutes() === 0
        ? 24
        : Math.ceil((endDt.getHours() * 60 + endDt.getMinutes()) / 60);

      // If end date is a different day (crossed midnight), cap at 24
      if (endDt.getDate() !== dt.getDate()) {
        bEndHour = 24;
      }

      if (bStartHour < minHour) minHour = bStartHour;
      if (bEndHour > maxHour) maxHour = bEndHour;
    }

    for (const bs of weekBlockedSlots) {
      if (bs.allDay) continue;
      // weekBlockedSlots prep already substitutes from startDate /
      // endDate when the time strings are absent, so these are
      // always non-null here. Defensive parse anyway.
      const [sh] = (bs.startTime || '00:00').split(':').map(Number);
      const [eh, em] = (bs.endTime || '00:00').split(':').map(Number);
      const startHour = sh;
      let endHour =
        eh === 0 && em === 0 ? 24 : Math.ceil(eh + em / 60);
      // crossing midnight (end ≤ start) → cap at 24
      if (endHour <= startHour) endHour = 24;

      if (startHour < minHour) minHour = startHour;
      if (endHour > maxHour) maxHour = endHour;
    }

    return {
      effectiveStartHour: Math.max(0, minHour),
      effectiveEndHour: Math.min(24, maxHour),
    };
  }, [bookings, weekBlockedSlots]);

  // ---- Handlers ----
  const handleBookingPress = useCallback(
    (id: string) => {
      router.push(`/(pro)/booking-detail/${id}` as any);
    },
    [router],
  );

  // Tap on activity / blocked slot.
  //
  // Activities open the dedicated edit screen directly — same
  // pattern as a booking opens its detail screen. The Modifier /
  // Supprimer choice happens inside that screen, not in a native
  // alert (which felt jarring vs. the booking flow). See user
  // feedback 2026-05-08.
  //
  // Plain blocked periods (vacation, training without category)
  // don't have an edit screen yet, so we keep the inline confirm
  // → delete path. After the delete, refresh blockedSlots so the
  // calendar updates immediately (the previous version waited for
  // the next focus event, which never fired since we stayed on
  // the same screen).
  const handleBlockedSlotPress = useCallback(
    (id: string) => {
      const slot = blockedSlots.find((s) => s.id === id);
      const isActivity = !!slot?.category;

      if (isActivity && slot) {
        // Detect other activities sharing any time window with the
        // tapped one. If there's more than one, show a sheet so the
        // pro can pick — overlapping activities all stack at the
        // same z-index and only the topmost would otherwise receive
        // taps.
        const overlapping = blockedSlots.filter(
          (other) =>
            !!other.category &&
            (selectedMemberId == null || other.memberId === selectedMemberId) &&
            overlapsInTime(slot, other),
        );
        if (overlapping.length > 1) {
          setDisambiguationActivities(overlapping);
        } else {
          router.push(`/(pro)/create-activity?id=${id}` as any);
        }
        return;
      }

      const label = slot?.reason || t('proCalendar.blockedSlot.fallbackLabel');
      Alert.alert(label, t('proCalendar.blockedSlot.deleteMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proCalendar.blockedSlot.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            try {
              await schedulingService.unblockPeriod(providerId, id);
              // Drop the row from local state so the calendar
              // reflects the delete without a refetch.
              setBlockedSlots((prev) => prev.filter((s) => s.id !== id));
            } catch (err) {
              Alert.alert(
                t('proCalendar.blockedSlot.errorTitle'),
                err instanceof Error ? err.message : t('proCalendar.blockedSlot.deleteError'),
              );
            }
          },
        },
      ]);
    },
    [blockedSlots, providerId, router, t],
  );

  const handleCreateBooking = useCallback(() => {
    setShowAddSheet(false);
    const dateStr = selectedDate.toISOString();
    const memberParam = selectedMemberId ? `&memberId=${selectedMemberId}` : '';
    router.push(`/(pro)/create-booking?date=${dateStr}${memberParam}` as any);
  }, [router, selectedDate, selectedMemberId]);

  const handleCreateActivity = useCallback(() => {
    setShowAddSheet(false);
    const dateStr = selectedDate.toISOString();
    const memberParam = selectedMemberId ? `&memberId=${selectedMemberId}` : '';
    router.push(`/(pro)/create-activity?date=${dateStr}${memberParam}` as any);
  }, [router, selectedDate, selectedMemberId]);

  const handleBlockSlot = useCallback(() => {
    setShowAddSheet(false);
    const dateStr = selectedDate.toISOString();
    router.push(`/(pro)/block-slot?date=${dateStr}` as any);
  }, [router, selectedDate]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleMemberSelect = useCallback((memberId: string | null) => {
    setSelectedMemberId(memberId);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(mode);
  }, []);

  const handleWeekDayPress = useCallback((date: Date) => {
    setSelectedDate(date);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode('day');
  }, []);

  const navigateDate = useCallback(
    (direction: -1 | 1) => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        if (viewMode === 'week') {
          next.setDate(next.getDate() + direction * 7);
        } else if (viewMode === 'month') {
          next.setMonth(next.getMonth() + direction);
        } else {
          next.setDate(next.getDate() + direction);
        }
        return next;
      });
    },
    [viewMode],
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  }, []);

  // ---- Date picker for jumping to a specific date ----
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDatePickerChange = useCallback((_: any, date: Date | undefined) => {
    setShowDatePicker(false);
    if (date) {
      date.setHours(0, 0, 0, 0);
      setSelectedDate(date);
    }
  }, []);

  // ---- Pull-to-refresh ----
  const [refreshing, setRefreshing] = useState(false);

  // ---- Did we ever finish a load? ----
  // Tracks whether the initial load has completed at least once.
  // Used to keep the calendar visible during *subsequent* refreshes
  // (return from /create-activity, focus regained, etc.) instead of
  // unmounting it behind a Loader. Without this, WeekView remounts
  // on every refresh, which resets its internal scroll position
  // back to col 1 — see commit 4587f0d (which only fixed the
  // re-render path, not the unmount path).
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    if (!isLoading) hasLoadedOnce.current = true;
  }, [isLoading]);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh(),
      providerId ? schedulingService.getBlockedSlotsInRange(providerId, fetchStart, fetchEnd).then(setBlockedSlots) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refresh, providerId, fetchStart, fetchEnd]);

  // ---- Auto-refresh when screen regains focus (e.g. after creating a booking) ----
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // Skip the initial focus (data is already loaded via useEffect)
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refresh();
      if (providerId) {
        schedulingService.getBlockedSlotsInRange(providerId, fetchStart, fetchEnd).then(setBlockedSlots).catch(() => {});
      }
    }, [refresh, providerId, fetchStart, fetchEnd]),
  );

  // ---- Booking count for today badge ----
  const todayBookingCount = useMemo(() => {
    if (viewMode === 'day') return dayBookings.length;
    return weekBookings.filter((b) => isSameDay(b.datetime, selectedDate))
      .length;
  }, [viewMode, dayBookings, weekBookings, selectedDate]);

  // ---- Header date display ----
  const headerDateText = useMemo(() => {
    if (viewMode === 'month') {
      return `${capitalize(monthName(selectedDate))} ${selectedDate.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const endDate = weekDays[weekDays.length - 1];
      const startDay = weekDays[0].getDate();
      const endDay = endDate.getDate();
      const startMonth = capitalize(monthName(weekDays[0]));
      const endMonth = capitalize(monthName(endDate));

      if (weekDays[0].getMonth() === endDate.getMonth()) {
        return `${startDay} - ${endDay} ${startMonth}`;
      }
      return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    }
    return formatHeaderDate(selectedDate);
    // t in deps: re-derive the Intl-based labels on language change.
  }, [selectedDate, viewMode, weekDays, t]);

  // ---- Render ----
  return (
    <View
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* ===== Branded Header ===== */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View
          style={[
            styles.headerTopRow,
            {
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
            },
          ]}
        >
          <Text variant="h2" style={{ color: '#FFFFFF' }}>{t('proCalendar.title')}</Text>
          {!isToday(selectedDate) && (
            <Pressable
              onPress={goToToday}
              style={({ pressed }) => [
                styles.todayButton,
                {
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              hitSlop={8}
            >
              <Text
                variant="caption"
                style={{ fontWeight: '600', color: '#FFFFFF' }}
              >
                {t('dates.today')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ===== Sub-Header (date nav + toggle) ===== */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          },
        ]}
      >

        {/* Date navigation row */}
        <View style={styles.dateNavRow}>
          <Pressable
            onPress={() => navigateDate(-1)}
            style={({ pressed }) => [
              styles.navArrow,
              {
                backgroundColor: pressed
                  ? colors.surfaceSecondary
                  : 'transparent',
                borderRadius: radius.full,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={styles.datePickerTrigger}
            hitSlop={8}
          >
            <Text
              variant="body"
              style={{ fontWeight: '600' }}
            >
              {headerDateText}
            </Text>
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primary}
              style={{ marginLeft: spacing.sm }}
            />
          </Pressable>

          <Pressable
            onPress={() => navigateDate(1)}
            style={({ pressed }) => [
              styles.navArrow,
              {
                backgroundColor: pressed
                  ? colors.surfaceSecondary
                  : 'transparent',
                borderRadius: radius.full,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* View toggle */}
        <View
          style={[styles.toggleRow, { marginTop: spacing.md }]}
        >
          <ViewToggle mode={viewMode} onChange={handleViewModeChange} />

          {/* Booking count badge */}
          {todayBookingCount > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  marginLeft: spacing.sm,
                },
              ]}
            >
              <Text
                variant="caption"
                color="primary"
                style={{ fontWeight: '600' }}
              >
                {t('proHome.countRdv', { count: todayBookingCount })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ===== Filters row (member + category dropdowns) ===== */}
      {/* Category filter is irrelevant in month view (it filters day/week
          bookings, not the availability grid) → hidden there. */}
      {(showMemberFilter || (categories.length > 0 && viewMode !== 'month')) && (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          }}
        >
          {showMemberFilter && (
            <View style={{ flex: 1 }}>
              <MemberSelect
                value={selectedMemberId}
                members={members}
                onChange={handleMemberSelect}
              />
            </View>
          )}
          {categories.length > 0 && viewMode !== 'month' && (
            <View style={{ flex: 1 }}>
              <CategorySelect
                value={selectedCategoryId}
                categories={categories.map((c) => ({ id: c.id, label: c.name }))}
                onChange={setSelectedCategoryId}
              />
            </View>
          )}
        </View>
      )}

      {/* ===== Content Area ===== */}
      {/* Loader only on the very first load — once we've shown the
          calendar at least once, subsequent refreshes keep the
          existing render so WeekView's scroll position survives. */}
      {isLoading && !refreshing && !hasLoadedOnce.current ? (
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      ) : viewMode === 'day' ? (
        /* ---- Day View ---- */
        <View style={{ flex: 1 }}>
          {/* Day schedule */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing['5xl'],
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {dayBookings.length > 0 || dayBlockedSlots.length > 0 ? (
              <DaySchedule
                date={selectedDate}
                bookings={dayBookings}
                blockedSlots={dayBlockedSlots}
                onBookingPress={handleBookingPress}
                onBlockedSlotPress={handleBlockedSlotPress}
                workingHours={{
                  start: `${effectiveStartHour.toString().padStart(2, '0')}:00`,
                  end: effectiveEndHour === 24 ? '00:00' : `${effectiveEndHour.toString().padStart(2, '0')}:00`,
                }}
              />
            ) : (
              <View
                style={{
                  marginTop: spacing['4xl'],
                  alignItems: 'center',
                }}
              >
                <EmptyState
                  icon="calendar-outline"
                  title={t('proCalendar.emptyDay.title')}
                  description={t('proCalendar.emptyDay.description')}
                />
              </View>
            )}
          </ScrollView>
        </View>
      ) : viewMode === 'month' ? (
        /* ---- Month View ---- */
        <MonthCalendar
          providerId={providerId ?? ''}
          selectedDate={selectedDate}
          services={services}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          members={members}
          memberId={selectedMemberId}
          maxBookingAdvance={provider?.settings?.maxBookingAdvance ?? 60}
          onDayPress={handleWeekDayPress}
        />
      ) : (
        /* ---- Week View ---- */
        <WeekView
          weekDays={weekDays}
          selectedDate={selectedDate}
          bookings={weekBookings}
          blockedSlots={weekBlockedSlots}
          onDayPress={handleWeekDayPress}
          onBookingPress={handleBookingPress}
          onActivityPress={handleBlockedSlotPress}
          onDisambiguate={setDisambiguationBookings}
          showMemberAvatars={members.length > 1}
          startHour={effectiveStartHour}
          endHour={effectiveEndHour}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* ===== Unified "+ Ajouter" FAB ===== */}
      <View style={styles.fabContainer}>
        <Pressable
          onPress={() => setShowAddSheet(true)}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              ...themeShadows.lg,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Ionicons name="add" size={28} color={colors.textInverse} />
        </Pressable>
      </View>

      {/* ===== Add-anything bottom sheet =====
          Three flavours kept on equal footing — the pro picks the one
          that matches what they want to add. Block-slot and Activity
          intentionally live side-by-side: blocks are best for
          long absences, activities for ponctual planner items. */}
      <Modal
        visible={showAddSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddSheet(false)}
      >
        <Pressable
          style={styles.datePickerOverlay}
          onPress={() => setShowAddSheet(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                paddingBottom: spacing['2xl'],
              },
            ]}
          >
            {/* Drag handle */}
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
            <Text
              variant="h3"
              style={{
                marginBottom: spacing.lg,
                color: colors.text,
                fontWeight: '700',
              }}
            >
              {t('proCalendar.addSheet.title')}
            </Text>

            {/* Choice 1 — Réservation client */}
            <Pressable
              onPress={handleCreateBooking}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                  marginBottom: spacing.xs,
                  gap: spacing.md,
                },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.primaryLight || (colors.primary + '20'),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="calendar-outline" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600', color: colors.text }}>
                  {t('proCalendar.addSheet.booking')}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {t('proCalendar.addSheet.bookingDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            {/* Choice 2 — Activité perso */}
            <Pressable
              onPress={handleCreateActivity}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                  marginBottom: spacing.xs,
                  gap: spacing.md,
                },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#f9731620',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="flash-outline" size={22} color="#f97316" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600', color: colors.text }}>
                  {t('proCalendar.addSheet.activity')}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {t('proCalendar.addSheet.activityDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>

            {/* Choice 3 — Bloquer une période */}
            <Pressable
              onPress={handleBlockSlot}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                  gap: spacing.md,
                },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.surfaceSecondary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600', color: colors.text }}>
                  {t('proCalendar.addSheet.block')}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {t('proCalendar.addSheet.blockDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== Disambiguation Bottom Sheet ===== */}
      <Modal
        visible={disambiguationBookings !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDisambiguationBookings(null)}
      >
        <Pressable
          style={styles.datePickerOverlay}
          onPress={() => setDisambiguationBookings(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={[
              styles.datePickerModal,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: 400,
              },
            ]}
          >
            {/* Header */}
            <View
              style={[
                styles.datePickerHeader,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Text variant="body" style={{ fontWeight: '600' }}>
                {t('proCalendar.bookingsCount', { count: disambiguationBookings?.length ?? 0 })}
              </Text>
              <Pressable onPress={() => setDisambiguationBookings(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Booking list */}
            <ScrollView style={{ paddingVertical: spacing.xs }}>
              {disambiguationBookings?.sort((a, b) =>
                a.datetime.getTime() - b.datetime.getTime()
              ).map((booking) => {
                const timeStr = `${booking.datetime.getHours().toString().padStart(2, '0')}:${booking.datetime.getMinutes().toString().padStart(2, '0')}`;
                const statusColor = booking.status === 'confirmed' ? colors.success
                  : booking.status === 'pending' ? colors.warning
                  : colors.textMuted;

                return (
                  <Pressable
                    key={booking.id}
                    onPress={() => {
                      setDisambiguationBookings(null);
                      handleBookingPress(booking.id);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.divider,
                      gap: spacing.sm,
                    })}
                  >
                    {/* Member color dot */}
                    {booking.memberColor && (
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: booking.memberColor,
                      }} />
                    )}

                    {/* Time */}
                    <Text variant="label" style={{ fontWeight: '600', minWidth: 40 }}>
                      {timeStr}
                    </Text>

                    {/* Status dot */}
                    <View style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: statusColor,
                    }} />

                    {/* Client + service */}
                    <View style={{ flex: 1 }}>
                      <Text variant="body" numberOfLines={1} style={{ fontWeight: '500' }}>
                        {booking.clientName}
                      </Text>
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>
                        {booking.serviceName}
                        {booking.memberName ? ` · ${booking.memberName}` : ''}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== Activity Disambiguation Bottom Sheet ===== */}
      {/* Same UX as the booking version above, but with the
          activity-specific fields (title, category, amount). */}
      <Modal
        visible={disambiguationActivities !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDisambiguationActivities(null)}
      >
        <Pressable
          style={styles.datePickerOverlay}
          onPress={() => setDisambiguationActivities(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={[
              styles.datePickerModal,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: 400,
              },
            ]}
          >
            <View
              style={[
                styles.datePickerHeader,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.divider,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Text variant="body" style={{ fontWeight: '600' }}>
                {t('proCalendar.activitiesAtSlot', { count: disambiguationActivities?.length ?? 0 })}
              </Text>
              <Pressable onPress={() => setDisambiguationActivities(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingVertical: spacing.xs }}>
              {disambiguationActivities
                ?.slice()
                .sort((a, b) => {
                  // Sort by start time-of-day so the list reads
                  // chronologically inside the overlapping window.
                  const at = a.startTime ?? '00:00';
                  const bt = b.startTime ?? '00:00';
                  return at.localeCompare(bt);
                })
                .map((activity) => {
                  const meta = activity.category
                    ? ACTIVITY_CATEGORY_META[activity.category]
                    : null;
                  const accent = meta?.color || colors.textMuted;
                  const timeStr =
                    activity.allDay
                      ? t('proCalendar.allDay')
                      : `${activity.startTime ?? '—'} – ${activity.endTime ?? '—'}`;
                  return (
                    <Pressable
                      key={activity.id}
                      onPress={() => {
                        setDisambiguationActivities(null);
                        router.push(
                          `/(pro)/create-activity?id=${activity.id}` as any,
                        );
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.md,
                        backgroundColor: pressed
                          ? colors.surfaceSecondary
                          : 'transparent',
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.divider,
                        gap: spacing.sm,
                      })}
                    >
                      {/* Category color dot */}
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: accent,
                        }}
                      />

                      {/* Time */}
                      <Text
                        variant="label"
                        style={{ fontWeight: '600', minWidth: 88 }}
                      >
                        {timeStr}
                      </Text>

                      {/* Title + category */}
                      <View style={{ flex: 1 }}>
                        <Text
                          variant="body"
                          numberOfLines={1}
                          style={{ fontWeight: '500' }}
                        >
                          {activity.title || meta?.label || t('proCalendar.activityFallback')}
                        </Text>
                        {meta && (
                          <Text
                            variant="caption"
                            color="textSecondary"
                            numberOfLines={1}
                          >
                            {meta.label}
                          </Text>
                        )}
                      </View>

                      {/* Amount badge if present */}
                      {activity.amount != null && activity.amount > 0 && (
                        <Text
                          variant="caption"
                          style={{
                            color: colors.text,
                            fontWeight: '700',
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {formatActivityAmount(activity.amount)}
                        </Text>
                      )}

                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  );
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== Date Picker Modal ===== */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View
              style={[
                styles.datePickerModal,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                },
              ]}
            >
              <View
                style={[
                  styles.datePickerHeader,
                  {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  },
                ]}
              >
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <Text variant="body" color="textSecondary">
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {t('proCalendar.pickDate')}
                </Text>
                <Pressable
                  onPress={() => {
                    setShowDatePicker(false);
                  }}
                >
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
                    {t('proCalendar.ok')}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="inline"
                themeVariant="light"
                onChange={(_, date) => {
                  if (date) {
                    date.setHours(0, 0, 0, 0);
                    setSelectedDate(date);
                  }
                }}
                style={{ height: 340 }}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            onChange={handleDatePickerChange}
          />
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  // Header
  header: {},
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // View toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    padding: 2,
  },
  togglePill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
  },
  toggleButton: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleTextActive: {
    fontWeight: '600',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Day view
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Loader
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Week view
  weekHeaderRow: {
    flexDirection: 'row',
  },
  weekHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  weekDateCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekGrid: {
    flexDirection: 'row',
  },
  weekTimeLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  weekGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  weekDayColumn: {
    position: 'relative',
  },
  weekBlockedBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  weekBookingBar: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  weekBookingAvatar: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  weekNowLine: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  weekNowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekNowLineLine: {
    flex: 1,
    height: 1.5,
  },

  // Date picker trigger
  datePickerTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Date picker modal
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // FABs
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'center',
    gap: 12,
  },
  fabSecondary: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
