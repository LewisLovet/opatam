/**
 * CalendarStrip Component
 * Horizontal date picker for booking flow
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface CalendarStripProps {
  /** Currently selected date */
  selectedDate: Date;
  /** Called when date is selected */
  onSelectDate: (date: Date) => void;
  /** Minimum selectable date (default: today) */
  minDate?: Date;
  /** Maximum selectable date (default: +60 days) */
  maxDate?: Date;
  /** Dates that are disabled/unavailable */
  disabledDates?: Date[];
  /** Days of the week that are always closed (0=Sun, 1=Mon, ..., 6=Sat) */
  closedDays?: number[];
}

const DAY_WIDTH = 56;
const DAY_GAP = 8;

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isDateDisabled(date: Date, disabledDates: Date[]): boolean {
  return disabledDates.some((d) => isSameDay(d, date));
}

function generateDays(minDate: Date, maxDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(minDate);
  current.setHours(0, 0, 0, 0);

  while (current <= maxDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

const SHORT_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const SHORT_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function CalendarStrip({
  selectedDate,
  onSelectDate,
  minDate,
  maxDate,
  disabledDates = [],
  closedDays = [],
}: CalendarStripProps) {
  const { colors, spacing, radius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveMinDate = minDate ?? today;
  const effectiveMaxDate = maxDate ?? new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  const days = generateDays(effectiveMinDate, effectiveMaxDate);

  // Scroll to selected date on mount and when selectedDate changes
  useEffect(() => {
    const selectedIndex = days.findIndex((d) => isSameDay(d, selectedDate));
    if (selectedIndex >= 0 && scrollRef.current) {
      const offset = selectedIndex * (DAY_WIDTH + DAY_GAP) - (DAY_WIDTH * 2);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: true });
      }, 100);
    }
  }, [selectedDate.toDateString()]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, { paddingHorizontal: spacing.lg, gap: DAY_GAP }]}
    >
      {days.map((day) => {
        const isSelected = isSameDay(day, selectedDate);
        const isToday = isSameDay(day, today);
        const isDisabled = isDateDisabled(day, disabledDates) || closedDays.includes(day.getDay());

        return (
          <Pressable
            key={day.toISOString()}
            onPress={() => !isDisabled && onSelectDate(day)}
            disabled={isDisabled}
            style={[
              styles.dayContainer,
              {
                width: DAY_WIDTH,
                borderRadius: radius.lg,
                paddingVertical: spacing.sm,
                backgroundColor: isSelected ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: isSelected ? colors.primary : colors.border,
                opacity: isDisabled ? 0.4 : 1,
              },
            ]}
          >
            <Text
              variant="caption"
              color={isSelected ? 'textInverse' : 'textSecondary'}
              style={styles.dayName}
            >
              {SHORT_DAYS[day.getDay()]}
            </Text>
            <Text
              variant="h3"
              color={isSelected ? 'textInverse' : 'text'}
              style={styles.dayNumber}
            >
              {day.getDate()}
            </Text>
            <Text
              variant="caption"
              color={isSelected ? 'textInverse' : 'textMuted'}
              style={styles.monthName}
            >
              {SHORT_MONTHS[day.getMonth()]}
            </Text>

            {/* Today indicator dot */}
            {isToday && !isSelected && (
              <View
                style={[
                  styles.todayDot,
                  { backgroundColor: colors.primary },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: {
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  dayNumber: {
    marginVertical: 2,
  },
  monthName: {
    fontSize: 10,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
