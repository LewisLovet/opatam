/**
 * MonthCalendar — collapsible month grid for the booking flow.
 *
 * Expanded: full month grid (like the web), each day showing its availability
 * state (available / almost_full / full / closed) before any tap. Picking a day
 * collapses the grid to that day's week, leaving room for the time slots below
 * (the user's "no-scroll for the time" goal, kept). A chevron re-expands it.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface DayState {
  status: 'available' | 'almost_full' | 'full' | 'closed';
  capacity: number;
}

export interface MonthCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** Per-day state keyed by local YYYY-MM-DD. */
  dayStatus: Record<string, DayState>;
  minDate: Date;
  maxDate: Date;
}

const WEEKDAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const AMBER = '#D97706';
const GREEN = '#10B981';

function dateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function buildWeeks(viewMonth: Date): (Date | null)[][] {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function MonthCalendar({ selectedDate, onSelectDate, dayStatus, minDate, maxDate }: MonthCalendarProps) {
  const { colors, spacing, radius } = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));

  // Keep the displayed month in sync with the selected day.
  useEffect(() => {
    setViewMonth(startOfMonth(selectedDate));
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  const minMonth = startOfMonth(minDate);
  const maxMonth = startOfMonth(maxDate);
  const canPrev = viewMonth > minMonth;
  const canNext = viewMonth < maxMonth;

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const handleSelect = (day: Date) => {
    animate();
    onSelectDate(day);
    setCollapsed(true);
  };
  const toggleCollapsed = () => {
    animate();
    setCollapsed((c) => !c);
  };
  const changeMonth = (delta: number) => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1);
    if (next >= minMonth && next <= maxMonth) setViewMonth(next);
  };

  const allWeeks = buildWeeks(viewMonth);
  const weeks = collapsed
    ? [allWeeks.find((w) => w.some((d) => d && isSameDay(d, selectedDate))) ?? allWeeks[0]]
    : allWeeks;

  const renderCell = (day: Date | null, idx: number) => {
    if (!day) return <View key={`e${idx}`} style={styles.cell} />;

    const key = dateKeyLocal(day);
    const info = dayStatus[key];
    const isPast = day < minDate || day > maxDate;
    const status = isPast ? 'past' : info?.status ?? 'closed';
    const selected = isSameDay(day, selectedDate);
    const clickable = !isPast && (status === 'available' || status === 'almost_full');

    let numberColor: string = colors.text;
    let bottomLabel: string | null = null;
    let bottomColor: string = colors.textMuted;
    let showGreenDot = false;
    let opacity = 1;
    let struck = false;

    if (selected) {
      // handled by background below
    } else if (status === 'available') {
      showGreenDot = true;
    } else if (status === 'almost_full') {
      bottomLabel = `${info!.capacity} pl.`;
      bottomColor = AMBER;
    } else if (status === 'full') {
      numberColor = colors.textMuted;
      struck = true;
      bottomLabel = 'Complet';
      bottomColor = colors.textMuted;
      opacity = 0.7;
    } else {
      // closed / past
      numberColor = colors.textMuted;
      opacity = 0.4;
    }

    return (
      <Pressable
        key={key}
        onPress={() => clickable && handleSelect(day)}
        disabled={!clickable}
        style={[
          styles.cell,
          {
            borderRadius: radius.md,
            backgroundColor: selected ? colors.primary : 'transparent',
            opacity,
          },
        ]}
      >
        <Text
          variant="body"
          style={{
            fontSize: 15,
            fontWeight: selected ? '700' : '500',
            color: selected ? colors.textInverse : numberColor,
            textDecorationLine: struck ? 'line-through' : 'none',
          }}
        >
          {day.getDate()}
        </Text>
        {bottomLabel ? (
          <Text variant="caption" style={{ fontSize: 9, lineHeight: 11, color: selected ? colors.textInverse : bottomColor }}>
            {bottomLabel}
          </Text>
        ) : showGreenDot && !selected ? (
          <View style={[styles.dot, { backgroundColor: GREEN }]} />
        ) : (
          <View style={styles.dotPlaceholder} />
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => changeMonth(-1)} disabled={collapsed || !canPrev} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={collapsed || !canPrev ? colors.textMuted : colors.text} />
          </Pressable>

          <Pressable onPress={toggleCollapsed} style={styles.monthToggle}>
            <Text variant="body" style={{ fontWeight: '700' }}>
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </Text>
            <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={colors.textSecondary} />
          </Pressable>

          <Pressable onPress={() => changeMonth(1)} disabled={collapsed || !canNext} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={collapsed || !canNext ? colors.textMuted : colors.text} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <View key={w} style={styles.cell}>
              <Text variant="caption" style={{ fontSize: 10, color: colors.textMuted }}>{w}</Text>
            </View>
          ))}
        </View>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <View key={`w${wi}`} style={styles.weekRow}>
            {week.map((day, di) => renderCell(day, di))}
          </View>
        ))}

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: GREEN }]} /><Text variant="caption" style={styles.legendText}>Dispo</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: AMBER }]} /><Text variant="caption" style={styles.legendText}>Bientôt complet</Text></View>
          <View style={styles.legendItem}><Text variant="caption" style={[styles.legendText, { textDecorationLine: 'line-through' }]}>Complet</Text></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#888',
  },
});
