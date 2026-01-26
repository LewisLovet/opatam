/**
 * BookingListItem Component
 * Compact booking item for Pro booking lists with quick actions
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import { BookingStatusBadge, type BookingStatus } from '../BookingStatusBadge';

export interface BookingListItemProps {
  /** Booking time (e.g., "14:30") */
  time: string;
  /** Client display name */
  clientName: string;
  /** Client initials for avatar (optional) */
  clientInitials?: string;
  /** Service name */
  serviceName: string;
  /** Duration in minutes */
  duration: number;
  /** Booking status */
  status: BookingStatus;
  /** Press handler for the item */
  onPress?: () => void;
  /** Quick confirm action (shown for pending bookings) */
  onConfirm?: () => void;
  /** Quick cancel action */
  onCancel?: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes}`;
}

export function BookingListItem({
  time,
  clientName,
  clientInitials,
  serviceName,
  duration,
  status,
  onPress,
  onConfirm,
  onCancel,
}: BookingListItemProps) {
  const { colors, spacing, radius } = useTheme();

  const showQuickActions = status === 'pending' && (onConfirm || onCancel);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        },
      ]}
    >
      {/* Left: Time info */}
      <View style={[styles.timeColumn, { marginRight: spacing.md }]}>
        <Text variant="body" style={styles.time}>
          {time}
        </Text>
        <Text variant="caption" color="textMuted">
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Center: Client & Service info */}
      <View style={styles.centerColumn}>
        <View style={[styles.clientRow, { gap: spacing.sm }]}>
          <Avatar size="sm" name={clientName} />
          <View style={styles.clientInfo}>
            <Text variant="body" numberOfLines={1} style={styles.clientName}>
              {clientName}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {serviceName}
            </Text>
          </View>
        </View>
      </View>

      {/* Right: Status & Actions */}
      <View style={[styles.rightColumn, { gap: spacing.sm }]}>
        <BookingStatusBadge status={status} size="sm" />

        {showQuickActions && (
          <View style={[styles.quickActions, { gap: spacing.xs }]}>
            {onConfirm && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onConfirm();
                }}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.successLight,
                    borderRadius: radius.full,
                  },
                ]}
                hitSlop={8}
              >
                <Ionicons name="checkmark" size={16} color={colors.successDark} />
              </Pressable>
            )}
            {onCancel && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: colors.errorLight,
                    borderRadius: radius.full,
                  },
                ]}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={colors.errorDark} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeColumn: {
    width: 50,
    alignItems: 'flex-start',
  },
  time: {
    fontWeight: '600',
  },
  centerColumn: {
    flex: 1,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontWeight: '500',
  },
  rightColumn: {
    alignItems: 'flex-end',
  },
  quickActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
