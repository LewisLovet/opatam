/**
 * BookingCard Component
 * Card displaying a booking summary for lists
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import { BookingStatusBadge, type BookingStatus } from '../BookingStatusBadge';

export interface BookingCardProps {
  /** Booking date */
  date: Date;
  /** Time string (e.g. "14:30") */
  time: string;
  /** Provider/business name */
  providerName: string;
  /** Provider photo URL */
  providerPhotoURL?: string | null;
  /** Service name */
  serviceName: string;
  /** Duration in minutes */
  duration: number;
  /** Booking status */
  status: BookingStatus;
  /** Press handler */
  onPress?: () => void;
}

function formatBookingDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function BookingCard({
  date,
  time,
  providerName,
  providerPhotoURL,
  serviceName,
  duration,
  status,
  onPress,
}: BookingCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-GB' : 'fr-FR';

  const content = (
    <View
      style={[
        styles.container,
        {
          padding: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          ...shadows.sm,
        },
      ]}
    >
      <View style={[styles.content, { gap: spacing.md }]}>
        {/* Avatar */}
        <Avatar
          size="md"
          name={providerName}
          imageUrl={providerPhotoURL ?? undefined}
        />

        {/* Info */}
        <View style={styles.info}>
          <Text variant="body" style={styles.providerName} numberOfLines={1}>
            {providerName}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {serviceName}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('components.bookingCard.dateAtTime', {
              date: formatBookingDate(date, dateLocale),
              time,
            })}
          </Text>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <BookingStatusBadge status={status} size="sm" />
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  providerName: {
    fontWeight: '600',
  },
  statusContainer: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
