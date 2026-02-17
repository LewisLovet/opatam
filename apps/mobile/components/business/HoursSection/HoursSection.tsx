/**
 * HoursSection Component
 * Displays weekly opening hours with current day highlighting
 * Mobile adaptation of the web HoursCard component
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface DaySchedule {
  day: string;
  isOpen: boolean;
  slots: { start: string; end: string }[];
}

export interface HoursSectionProps {
  weekSchedule: DaySchedule[];
  isCurrentlyOpen: boolean;
}

/**
 * Convert JS day index (0=Sun) to Monday-first index (0=Mon, 6=Sun)
 */
function getCurrentDayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1; // Convert to Mon-first (0=Mon, 6=Sun)
}

export function HoursSection({ weekSchedule, isCurrentlyOpen }: HoursSectionProps) {
  const { colors, spacing, radius } = useTheme();

  const currentDayIndex = useMemo(() => getCurrentDayIndex(), []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { marginBottom: spacing.md }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="time-outline" size={20} color={colors.text} />
          <Text variant="h3" style={{ marginLeft: spacing.sm }}>
            Horaires
          </Text>
        </View>

        {/* Open/Closed badge */}
        <View
          style={[
            styles.badge,
            {
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: isCurrentlyOpen ? '#dcfce7' : '#fecaca',
            },
          ]}
        >
          <Ionicons
            name={isCurrentlyOpen ? 'checkmark-circle' : 'close-circle'}
            size={14}
            color={isCurrentlyOpen ? '#15803d' : '#b91c1c'}
          />
          <Text
            variant="caption"
            style={{
              color: isCurrentlyOpen ? '#15803d' : '#b91c1c',
              fontWeight: '600',
            }}
          >
            {isCurrentlyOpen ? 'Ouvert' : 'Fermé'}
          </Text>
        </View>
      </View>

      {/* Days list */}
      <View style={styles.daysList}>
        {weekSchedule.map((day, index) => {
          const isCurrentDay = index === currentDayIndex;

          return (
            <View
              key={day.day}
              style={[
                styles.dayRow,
                {
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                },
                isCurrentDay && {
                  backgroundColor: colors.primaryLight,
                },
              ]}
            >
              {/* Day name */}
              <View style={styles.dayNameContainer}>
                <Text
                  variant="body"
                  style={[
                    styles.dayName,
                    isCurrentDay && { color: colors.primary, fontWeight: '600' },
                  ]}
                >
                  {day.day}
                </Text>
                {isCurrentDay && (
                  <Text
                    variant="caption"
                    style={{ color: colors.primary, fontWeight: '500', marginLeft: spacing.xs }}
                  >
                    (Aujourd'hui)
                  </Text>
                )}
              </View>

              {/* Time slots */}
              <Text
                variant="body"
                style={[
                  isCurrentDay
                    ? { color: colors.primary, fontWeight: '600' }
                    : day.isOpen
                      ? undefined
                      : { color: colors.textMuted },
                ]}
              >
                {day.isOpen
                  ? day.slots
                      .map((slot) => `${slot.start} - ${slot.end}`)
                      .join(', ')
                  : 'Fermé'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  daysList: {},
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayName: {
    fontWeight: '400',
  },
});
