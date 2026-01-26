/**
 * TimeSlotGrid Component
 * Grid display of available time slots
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { TimeSlot } from './TimeSlot';

export interface TimeSlotGridProps {
  /** Available time slots */
  slots: Array<{
    time: string;
    available: boolean;
  }>;
  /** Currently selected time */
  selectedTime: string | null;
  /** Called when a time is selected */
  onSelectTime: (time: string) => void;
}

export function TimeSlotGrid({
  slots,
  selectedTime,
  onSelectTime,
}: TimeSlotGridProps) {
  const { colors, spacing } = useTheme();

  const hasAvailableSlots = slots.some((slot) => slot.available);

  if (!hasAvailableSlots) {
    return (
      <View style={[styles.emptyContainer, { padding: spacing.xl }]}>
        <Text variant="body" color="textSecondary" align="center">
          Aucun créneau disponible pour cette date
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {slots.map((slot) => (
        <TimeSlot
          key={slot.time}
          time={slot.time}
          available={slot.available}
          selected={selectedTime === slot.time}
          onPress={() => onSelectTime(slot.time)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
