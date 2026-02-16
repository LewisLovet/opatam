/**
 * BookingRecap Component
 * Summary view before booking confirmation
 * Design: clean and simple, similar to BookingDetail
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

function formatFullDate(date: Date, time: string): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName} ${dayNum} ${monthName} ${year} à ${time}`;
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
          label="Prestation"
          value={service.name}
        />
        <InfoRow
          icon="time-outline"
          label="Durée"
          value={formatDuration(service.duration)}
        />
      </View>

      <Divider />

      {/* Date & Time Section - combined */}
      <View style={[styles.section, { padding: spacing.md }]}>
        <InfoRow
          icon="calendar-outline"
          label="Rendez-vous"
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
              label="Lieu"
              value={`${location.name}\n${location.address}`}
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
              label="Avec"
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
          Total
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
