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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { memberService, schedulingService } from '@booking-app/firebase';
import type { Member, BlockedSlot } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
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

type ViewMode = 'day' | 'week';

// Status filter kept outside component to avoid new array on every render
const CALENDAR_STATUS_FILTER: ('pending' | 'confirmed')[] = ['pending', 'confirmed'];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const WEEK_HOUR_HEIGHT = 48;
const DEFAULT_WEEK_START_HOUR = 7;
const DEFAULT_WEEK_END_HOUR = 21;
const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const FULL_DAY_NAMES = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];
const FULL_MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

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
  const dayName = FULL_DAY_NAMES[date.getDay()];
  const dayNum = date.getDate();
  const monthName = FULL_MONTH_NAMES[date.getMonth()];
  return `${dayName} ${dayNum} ${monthName}`;
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
 * Get the 7 days (Mon-Sun) of a week starting from Monday.
 */
function getWeekDays(monday: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
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
  const { colors, spacing, radius, shadows: themeShadows } = useTheme();
  const slideAnim = useRef(new Animated.Value(mode === 'day' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'day' ? 0 : 1,
      useNativeDriver: false,
      tension: 300,
      friction: 25,
    }).start();
  }, [mode, slideAnim]);

  const toggleWidth = 200;
  const pillWidth = toggleWidth / 2;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, pillWidth - 2],
  });

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

      {/* Day button */}
      <Pressable
        onPress={() => onChange('day')}
        style={[styles.toggleButton, { width: pillWidth }]}
        hitSlop={4}
      >
        <Text
          variant="label"
          color={mode === 'day' ? 'text' : 'textSecondary'}
          style={mode === 'day' ? styles.toggleTextActive : undefined}
        >
          Jour
        </Text>
      </Pressable>

      {/* Week button */}
      <Pressable
        onPress={() => onChange('week')}
        style={[styles.toggleButton, { width: pillWidth }]}
        hitSlop={4}
      >
        <Text
          variant="label"
          color={mode === 'week' ? 'text' : 'textSecondary'}
          style={mode === 'week' ? styles.toggleTextActive : undefined}
        >
          Semaine
        </Text>
      </Pressable>
    </View>
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
}

interface WeekViewProps {
  weekDays: Date[];
  selectedDate: Date;
  bookings: WeekBooking[];
  blockedSlots?: WeekBlockedSlot[];
  onDayPress: (date: Date) => void;
  onBookingPress: (id: string) => void;
  onDisambiguate?: (bookings: WeekBooking[]) => void;
  showMemberAvatars: boolean;
  startHour?: number;
  endHour?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
}

function WeekView({
  weekDays,
  selectedDate,
  bookings,
  blockedSlots = [],
  onDayPress,
  onBookingPress,
  onDisambiguate,
  showMemberAvatars,
  startHour = DEFAULT_WEEK_START_HOUR,
  endHour = DEFAULT_WEEK_END_HOUR,
  refreshing = false,
  onRefresh,
}: WeekViewProps) {
  const { colors, spacing, radius } = useTheme();

  const weekTotalHours = endHour - startHour;
  const timeColumnWidth = 44;
  const availableWidth = SCREEN_WIDTH - spacing.lg * 2 - timeColumnWidth;
  const columnWidth = availableWidth / 7;
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

  /** Convert hex color to light tint (20% opacity equivalent) */
  function getLightTint(hex: string): string {
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

  return (
    <View style={{ flex: 1 }}>
      {/* Column headers */}
      <View
        style={[
          styles.weekHeaderRow,
          {
            paddingLeft: spacing.lg + timeColumnWidth,
            paddingRight: spacing.lg,
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.divider,
          },
        ]}
      >
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
                {DAY_LABELS[idx]}
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

          {/* Day columns */}
          <View style={{ flex: 1, flexDirection: 'row', position: 'relative' }}>
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
                  {/* Blocked slots */}
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
                            {bs.reason || 'Bloqué'}
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
                            backgroundColor: booking.memberColor
                              ? getLightTint(booking.memberColor)
                              : getStatusBgColor(booking.status),
                            borderLeftWidth: 2,
                            borderLeftColor: booking.memberColor || getStatusBarColor(
                              booking.status,
                            ),
                            borderRadius: radius.sm,
                            paddingHorizontal: 1,
                            paddingVertical: 1,
                          },
                        ]}
                      >
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
                        {/* Client name */}
                        {height > 22 && (
                          <Text
                            variant="caption"
                            numberOfLines={1}
                            style={{
                              fontSize: 9,
                              fontWeight: '600',
                              lineHeight: 11,
                            }}
                            color="text"
                          >
                            {booking.clientName.split(' ')[0]}
                          </Text>
                        )}
                        {/* Service name */}
                        {height > 34 && (
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { providerId, provider } = useProvider();
  const { memberId: memberIdParam } = useLocalSearchParams<{ memberId?: string }>();

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

  // ---- Date range for the selected day ----
  const dayStart = useMemo(() => startOfDay(selectedDate), [selectedDate]);
  const dayEnd = useMemo(() => endOfDay(selectedDate), [selectedDate]);

  // ---- Week data ----
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

  // ---- Fetch blocked slots for the current range ----
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);
  useEffect(() => {
    if (!providerId) return;
    schedulingService
      .getBlockedSlotsInRange(providerId, fetchStart, fetchEnd)
      .then(setBlockedSlots)
      .catch(() => setBlockedSlots([]));
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
      const key = `${startTime}-${endTime}-${bs.allDay}-${bs.reason || ''}`;
      if (!groups[key]) {
        groups[key] = { ids: [], bs, members: [] };
      }
      groups[key].ids.push(bs.id);
      groups[key].members.push({
        name: memberNameMap[bs.memberId] || 'Membre',
        color: memberColorMap[bs.memberId] || null,
      });
    }

    const activeMembers = members.filter((m) => m.isActive !== false);
    return Object.values(groups).map((g) => {
      const bsStart = g.bs.startDate instanceof Date ? g.bs.startDate : (g.bs.startDate as any).toDate();
      const bsEnd = g.bs.endDate instanceof Date ? g.bs.endDate : (g.bs.endDate as any).toDate();
      const isAllMembers = activeMembers.length > 1 && g.members.length >= activeMembers.length;
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
      };
    });
  }, [blockedSlots, viewMode, selectedMemberId, dayStart, dayEnd, memberNameMap, memberColorMap, members]);

  // ---- Transform bookings for Day View ----
  const dayBookings: DayScheduleBooking[] = useMemo(() => {
    if (viewMode !== 'day') return [];
    return filteredBookings.map((b) => {
      const dt =
        b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate();
      const endDt = addMinutes(dt, b.duration);
      return {
        id: b.id,
        startTime: formatTime(dt),
        endTime: formatTime(endDt),
        clientName: b.clientInfo.name,
        serviceName: b.serviceName,
        status: b.status,
        memberName: (b.memberId && memberNameMap[b.memberId]) || undefined,
        memberColor: (b.memberId && memberColorMap[b.memberId]) || b.memberColor || null,
      };
    });
  }, [filteredBookings, viewMode, memberNameMap, memberColorMap]);

  // ---- Transform bookings for Week View ----
  const weekBookings: WeekBooking[] = useMemo(() => {
    if (viewMode !== 'week') return [];
    return filteredBookings.map((b) => {
      const dt =
        b.datetime instanceof Date ? b.datetime : (b.datetime as any).toDate();
      return {
        id: b.id,
        datetime: dt,
        duration: b.duration,
        clientName: b.clientInfo.name,
        serviceName: b.serviceName,
        status: b.status,
        memberId: b.memberId ?? null,
        memberName: b.memberName ?? null,
        memberColor: (b.memberId && memberColorMap[b.memberId]) || b.memberColor || null,
      };
    });
  }, [filteredBookings, viewMode, memberColorMap]);

  // ---- Blocked slots for week view (grouped by same time + reason) ----
  const weekBlockedSlots = useMemo(() => {
    if (viewMode !== 'week') return [];
    const filtered = blockedSlots.filter((bs) => !selectedMemberId || bs.memberId === selectedMemberId);

    // Group by same start/end timestamps + allDay + reason
    const groups: Record<string, { slots: typeof filtered; members: WeekBlockedSlotMember[] }> = {};
    for (const bs of filtered) {
      const bsStart = bs.startDate instanceof Date ? bs.startDate : (bs.startDate as any).toDate();
      const bsEnd = bs.endDate instanceof Date ? bs.endDate : (bs.endDate as any).toDate();
      const key = `${bsStart.getTime()}-${bsEnd.getTime()}-${bs.allDay}-${bs.reason || ''}`;
      if (!groups[key]) {
        groups[key] = { slots: [], members: [] };
      }
      groups[key].slots.push(bs);
      groups[key].members.push({
        name: memberNameMap[bs.memberId] || 'Membre',
        color: memberColorMap[bs.memberId] || null,
      });
    }

    const activeMembers = members.filter((m) => m.isActive !== false);
    return Object.values(groups).map((g) => {
      const bs = g.slots[0];
      const bsStart = bs.startDate instanceof Date ? bs.startDate : (bs.startDate as any).toDate();
      const bsEnd = bs.endDate instanceof Date ? bs.endDate : (bs.endDate as any).toDate();
      const isAllMembers = activeMembers.length > 1 && g.members.length >= activeMembers.length;
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
      };
    });
  }, [blockedSlots, viewMode, selectedMemberId, memberNameMap, memberColorMap, members]);

  // ---- Compute effective hour range from bookings ----
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

    return {
      effectiveStartHour: Math.max(0, minHour),
      effectiveEndHour: Math.min(24, maxHour),
    };
  }, [bookings]);

  // ---- Handlers ----
  const handleBookingPress = useCallback(
    (id: string) => {
      router.push(`/(pro)/booking-detail/${id}` as any);
    },
    [router],
  );

  const handleCreateBooking = useCallback(() => {
    const dateStr = selectedDate.toISOString();
    const memberParam = selectedMemberId ? `&memberId=${selectedMemberId}` : '';
    router.push(`/(pro)/create-booking?date=${dateStr}${memberParam}` as any);
  }, [router, selectedDate, selectedMemberId]);

  const handleBlockSlot = useCallback(() => {
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
    if (viewMode === 'week') {
      const endDate = weekDays[6];
      const startDay = weekDays[0].getDate();
      const endDay = endDate.getDate();
      const startMonth = FULL_MONTH_NAMES[weekDays[0].getMonth()];
      const endMonth = FULL_MONTH_NAMES[endDate.getMonth()];

      if (weekDays[0].getMonth() === endDate.getMonth()) {
        return `${startDay} - ${endDay} ${startMonth}`;
      }
      return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    }
    return formatHeaderDate(selectedDate);
  }, [selectedDate, viewMode, weekDays]);

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
          <Text variant="h2" style={{ color: '#FFFFFF' }}>Agenda</Text>
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
                Aujourd'hui
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
                {todayBookingCount} RDV
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ===== Filters row (member + category dropdowns) ===== */}
      {(showMemberFilter || categories.length > 0) && (
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
          {categories.length > 0 && (
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
      {isLoading && !refreshing ? (
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
                  title="Aucun rendez-vous"
                  description="Vous n'avez pas de rendez-vous ce jour."
                />
              </View>
            )}
          </ScrollView>
        </View>
      ) : (
        /* ---- Week View ---- */
        <WeekView
          weekDays={weekDays}
          selectedDate={selectedDate}
          bookings={weekBookings}
          blockedSlots={weekBlockedSlots}
          onDayPress={handleWeekDayPress}
          onBookingPress={handleBookingPress}
          onDisambiguate={setDisambiguationBookings}
          showMemberAvatars={members.length > 1}
          startHour={effectiveStartHour}
          endHour={effectiveEndHour}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      {/* ===== FABs ===== */}
      <View style={styles.fabContainer}>
        {/* Secondary FAB — Block slot */}
        <Pressable
          onPress={handleBlockSlot}
          style={({ pressed }) => [
            styles.fabSecondary,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.border,
              ...themeShadows.md,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Ionicons name="ban-outline" size={20} color={colors.textSecondary} />
        </Pressable>

        {/* Primary FAB — New booking */}
        <Pressable
          onPress={handleCreateBooking}
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
                {disambiguationBookings?.length ?? 0} rendez-vous
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
                    Annuler
                  </Text>
                </Pressable>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  Choisir une date
                </Text>
                <Pressable
                  onPress={() => {
                    setShowDatePicker(false);
                  }}
                >
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
                    OK
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
