/**
 * BookingRecap Component
 * Summary view before booking confirmation
 * Design: clean and simple, similar to BookingDetail
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import { Divider } from '../../Divider';
import { Card } from '../../Card';

export interface BookingRecapProps {
  /** Provider info */
  provider: {
    name: string;
    photoURL?: string | null;
    address?: string;
  };
  /** Service info */
  service: {
    name: string;
    duration: number;
    price: number;
  };
  /** Selected member (optional) */
  member?: {
    name: string;
  } | null;
  /** Selected date */
  date: Date;
  /** Selected time */
  time: string;
  /** Location (if multi-location) */
  location?: {
    name: string;
    address: string;
  } | null;
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

function formatPrice(euros: number): string {
  return euros % 1 === 0 ? `${euros} €` : `${euros.toFixed(2)} €`;
}

export function BookingRecap({
  provider,
  service,
  member,
  date,
  time,
  location,
}: BookingRecapProps) {
  const { colors, spacing, radius } = useTheme();
  const { t, i18n } = useTranslation();

  const formatFullDate = (d: Date, tm: string): string => {
    const formatted = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
    const capitalized = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    return t('components.bookingRecap.dateAtTime', { date: capitalized, time: tm });
  };

  return (
    <Card padding="none" shadow="sm">
      {/* Provider Section - with background */}
      <View
        style={[
          styles.section,
          {
            padding: spacing.md,
            backgroundColor: colors.surfaceSecondary,
            borderTopLeftRadius: radius.lg - 1,
            borderTopRightRadius: radius.lg - 1,
          },
        ]}
      >
        <View style={[styles.row, { gap: spacing.md }]}>
          <Avatar
            size="lg"
            name={provider.name}
            imageUrl={provider.photoURL ?? undefined}
          />
          <View style={styles.flex}>
            <Text variant="body" style={styles.bold}>
              {provider.name}
            </Text>
            {provider.address && (
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {provider.address}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Service Section */}
      <View style={[styles.section, { padding: spacing.md }]}>
        <InfoRow
          icon="pricetag-outline"
          label={t('components.bookingRecap.service')}
          value={service.name}
        />
        <InfoRow
          icon="time-outline"
          label={t('components.bookingRecap.duration')}
          value={formatDuration(service.duration)}
        />
      </View>

      <Divider />

      {/* Date & Time Section - combined */}
      <View style={[styles.section, { padding: spacing.md }]}>
        <InfoRow
          icon="calendar-outline"
          label={t('components.bookingRecap.appointment')}
          value={formatFullDate(date, time)}
        />
      </View>

      {/* Location (if provided) */}
      {location && (
        <>
          <Divider />
          <View style={[styles.section, { padding: spacing.md }]}>
            <InfoRow
              icon="location-outline"
              label={t('components.bookingRecap.location')}
              value={location.address?.trim() ? `${location.name}\n${location.address}` : location.name}
            />
          </View>
        </>
      )}

      {/* Member (if provided) */}
      {member && (
        <>
          <Divider />
          <View style={[styles.section, { padding: spacing.md }]}>
            <InfoRow
              icon="person-outline"
              label={t('components.bookingRecap.with')}
              value={member.name}
            />
          </View>
        </>
      )}

      {/* Total Section - highlighted */}
      <View
        style={[
          styles.totalSection,
          {
            padding: spacing.md,
            backgroundColor: colors.primaryLight,
            borderBottomLeftRadius: radius.lg - 1,
            borderBottomRightRadius: radius.lg - 1,
          },
        ]}
      >
        <Text variant="body" style={{ color: colors.primary }}>
          {t('components.bookingRecap.total')}
        </Text>
        <Text variant="h2" style={{ color: colors.primary }}>
          {formatPrice(service.price)}
        </Text>
      </View>
    </Card>
  );
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.infoRow, { marginBottom: spacing.xs }]}>
      <Ionicons
        name={icon}
        size={18}
        color={colors.primary}
        style={{ marginRight: spacing.sm }}
      />
      <Text variant="caption" color="textSecondary" style={{ minWidth: 80 }}>
        {label}
      </Text>
      <Text variant="body" style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    flex: 1,
  },
  totalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
