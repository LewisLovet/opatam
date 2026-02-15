/**
 * DaySchedule Component
 * Vertical timeline view of bookings for a specific day (Pro mode)
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme, type Colors } from '../../../theme';
import { Text } from '../../Text';
import { type BookingStatus } from '../BookingStatusBadge';

export interface DayScheduleBooking {
  id: string;
  startTime: string; // "09:30"
  endTime: string; // "10:15"
  clientName: string;
  serviceName: string;
  status: BookingStatus;
}

export interface DayScheduleProps {
  /** The date being displayed */
  date: Date;
  /** List of bookings for the day */
  bookings: DayScheduleBooking[];
  /** Working hours (defaults to 09:00-19:00) */
  workingHours?: {
    start: string; // "09:00"
    end: string; // "19:00"
  };
  /** Callback when a booking is pressed */
  onBookingPress?: (id: string) => void;
}

const HOUR_HEIGHT = 60; // Height in pixels for each hour
const TIME_COLUMN_WIDTH = 50;

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getStatusColor(status: BookingStatus, colors: Colors): string {
  switch (status) {
    case 'confirmed':
      return colors.primaryLight;
    case 'pending':
      return colors.warningLight;
    case 'cancelled':
      return colors.surfaceSecondary;
    case 'noshow':
      return colors.errorLight;
    default:
      return colors.surfaceSecondary;
  }
}

function getStatusBorderColor(status: BookingStatus, colors: Colors): string {
  switch (status) {
    case 'confirmed':
      return colors.primary;
    case 'pending':
      return colors.warning;
    case 'cancelled':
      return colors.textMuted;
    case 'noshow':
      return colors.error;
    default:
      return colors.border;
  }
}

export function DaySchedule({
  date,
  bookings,
  workingHours = { start: '07:00', end: '21:00' },
  onBookingPress,
}: DayScheduleProps) {
  const { colors, spacing, radius } = useTheme();

  // Compute effective time range: expand to fit all bookings
  const { effectiveStart, effectiveEnd } = useMemo(() => {
    let wStart = parseTime(workingHours.start);
    let wEnd = parseTime(workingHours.end);

    // Handle 24h range: if start === end (both "00:00"), show full day
    if (wStart === wEnd) {
      wStart = 0;
      wEnd = 24 * 60;
    }
    // Handle end at midnight: treat "00:00" end as 24:00
    if (wEnd === 0 && wStart > 0) {
      wEnd = 24 * 60;
    }

    // Expand range to fit all bookings
    for (const b of bookings) {
      const bStart = parseTime(b.startTime);
      let bEnd = parseTime(b.endTime);
      // If endTime is "00:00" and startTime is not, treat as midnight (24:00)
      if (bEnd === 0 && bStart > 0) {
        bEnd = 24 * 60;
      }
      // Also handle endTime < startTime (crossing midnight)
      if (bEnd <= bStart) {
        bEnd = 24 * 60;
      }

      // Floor start to the previous full hour
      const bStartHour = Math.floor(bStart / 60) * 60;
      // Ceil end to the next full hour
      const bEndHour = Math.ceil(bEnd / 60) * 60;

      if (bStartHour < wStart) wStart = bStartHour;
      if (bEndHour > wEnd) wEnd = bEndHour;
    }

    // Clamp to 0..1440
    wStart = Math.max(0, wStart);
    wEnd = Math.min(24 * 60, wEnd);

    return { effectiveStart: wStart, effectiveEnd: wEnd };
  }, [workingHours, bookings]);

  const startMinutes = effectiveStart;
  const endMinutes = effectiveEnd;
  const totalMinutes = endMinutes - startMinutes;
  const totalHeight = (totalMinutes / 60) * HOUR_HEIGHT;

  // Generate hour labels
  const hours = useMemo(() => {
    const result: string[] = [];
    const sHour = Math.floor(startMinutes / 60);
    const eHour = Math.ceil(endMinutes / 60);
    for (let h = sHour; h <= eHour; h++) {
      // Display hour 24 as "00:00" (midnight)
      const displayHour = h === 24 ? 0 : h;
      result.push(`${displayHour.toString().padStart(2, '0')}:00`);
    }
    return result;
  }, [startMinutes, endMinutes]);

  // Check if today to show "now" line
  const isToday = useMemo(() => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }, [date]);

  // Calculate "now" line position
  const nowPosition = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < startMinutes || nowMinutes > endMinutes) return null;
    return ((nowMinutes - startMinutes) / totalMinutes) * totalHeight;
  }, [isToday, startMinutes, endMinutes, totalMinutes, totalHeight]);

  return (
    <View style={[styles.schedule, { height: totalHeight }]}>
      {/* Hour labels and grid lines */}
      <View style={[styles.timeColumn, { width: TIME_COLUMN_WIDTH }]}>
        {hours.map((hour, index) => (
          <View
            key={`h-${index}`}
            style={[
              styles.hourLabel,
              { top: index * HOUR_HEIGHT - 8 },
            ]}
          >
            <Text variant="caption" color="textMuted">
              {hour}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid area */}
      <View style={styles.gridArea}>
        {/* Hour grid lines */}
        {hours.map((_, index) => (
          <View
            key={index}
            style={[
              styles.gridLine,
              {
                top: index * HOUR_HEIGHT,
                backgroundColor: colors.divider,
              },
            ]}
          />
        ))}

        {/* Bookings */}
        {bookings.map((booking) => {
          const bookingStart = parseTime(booking.startTime);
          let bookingEnd = parseTime(booking.endTime);
          // Handle endTime at midnight or crossing midnight
          if (bookingEnd === 0 && bookingStart > 0) bookingEnd = 24 * 60;
          if (bookingEnd <= bookingStart) bookingEnd = 24 * 60;

          const top = ((bookingStart - startMinutes) / totalMinutes) * totalHeight;
          const height = ((bookingEnd - bookingStart) / totalMinutes) * totalHeight;

          return (
            <Pressable
              key={booking.id}
              onPress={() => onBookingPress?.(booking.id)}
              style={[
                styles.bookingBlock,
                {
                  top,
                  height: Math.max(height, 40), // Minimum height for visibility
                  backgroundColor: getStatusColor(booking.status, colors),
                  borderLeftColor: getStatusBorderColor(booking.status, colors),
                  borderRadius: radius.sm,
                  padding: spacing.xs,
                  marginLeft: spacing.xs,
                },
              ]}
            >
              <Text variant="caption" style={styles.bookingTime}>
                {booking.startTime} - {booking.endTime}
              </Text>
              <Text variant="caption" numberOfLines={1} style={styles.clientName}>
                {booking.clientName}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ fontSize: 11 }}>
                {booking.serviceName}
              </Text>
            </Pressable>
          );
        })}

        {/* "Now" line */}
        {nowPosition !== null && (
          <View
            style={[
              styles.nowLine,
              {
                top: nowPosition,
                backgroundColor: colors.error,
              },
            ]}
          >
            <View
              style={[
                styles.nowDot,
                { backgroundColor: colors.error },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  schedule: {
    flexDirection: 'row',
  },
  timeColumn: {
    position: 'relative',
  },
  hourLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  gridArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  bookingBlock: {
    position: 'absolute',
    left: 0,
    right: 8,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  bookingTime: {
    fontWeight: '600',
  },
  clientName: {
    fontWeight: '500',
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 10,
  },
  nowDot: {
    position: 'absolute',
    left: -4,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
