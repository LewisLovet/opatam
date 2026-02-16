/**
 * BookingDetail Component
 * Full detail view of a booking (modal or screen)
 */

import React from 'react';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import { Button } from '../../Button';
import { Divider } from '../../Divider';
import { BookingStatusBadge, type BookingStatus } from '../BookingStatusBadge';

export interface BookingDetailProps {
  /** Booking data */
  booking: {
    id: string;
    date: Date;
    time: string;
    provider: {
      name: string;
      photoURL?: string | null;
      phone?: string | null;
      address?: string;
    };
    service: {
      name: string;
      duration: number;
      price: number;
    };
    member?: {
      name: string;
    } | null;
    status: BookingStatus;
    location?: {
      name: string;
      address: string;
    } | null;
  };
  /** Cancel action */
  onCancel?: () => void;
  /** Review action */
  onReview?: () => void;
  /** Call action */
  onCall?: () => void;
  /** Close action */
  onClose?: () => void;
  /** Whether shown as modal */
  isModal?: boolean;
}

function formatFullDateWithTime(date: Date, time: string): string {
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

export function BookingDetail({
  booking,
  onCancel,
  onReview,
  onCall,
  onClose,
  isModal = false,
}: BookingDetailProps) {
  const { colors, spacing, radius } = useTheme();

  const isPast = booking.date < new Date();
  const canCancel = booking.status === 'confirmed' && !isPast;
  const canReview = booking.status === 'confirmed' && isPast;
  const hasPhone = !!booking.provider.phone;

  const handleCall = () => {
    if (onCall) {
      onCall();
    } else if (booking.provider.phone) {
      Linking.openURL(`tel:${booking.provider.phone}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with close button if modal */}
      {isModal && onClose && (
        <View style={[styles.modalHeader, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
      )}

      {/* Status and Date - combined on one line */}
      <View style={[styles.section, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <View style={styles.statusRow}>
          <BookingStatusBadge status={booking.status} />
        </View>
        <Text variant="h2" style={{ marginTop: spacing.sm }}>
          {formatFullDateWithTime(booking.date, booking.time)}
        </Text>
      </View>

      <Divider />

      {/* Provider Section */}
      <View style={[styles.section, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <View style={[styles.row, { gap: spacing.md }]}>
          <Avatar
            size="lg"
            name={booking.provider.name}
            imageUrl={booking.provider.photoURL ?? undefined}
          />
          <View style={styles.providerInfo}>
            <Text variant="body" style={styles.bold}>
              {booking.provider.name}
            </Text>
            {booking.provider.address && (
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {booking.provider.address}
              </Text>
            )}
          </View>
          {hasPhone && (
            <Pressable
              onPress={handleCall}
              style={[
                styles.callButton,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  width: 44,
                  height: 44,
                },
              ]}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      <Divider />

      {/* Service Section */}
      <View style={[styles.section, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <InfoRow
          icon="pricetag-outline"
          label="Prestation"
          value={booking.service.name}
        />
        <InfoRow
          icon="time-outline"
          label="Durée"
          value={formatDuration(booking.service.duration)}
        />
        <InfoRow
          icon="pricetag-outline"
          label="Prix"
          value={formatPrice(booking.service.price)}
          bold
        />
      </View>

      {/* Location Section (if provided) */}
      {booking.location && (
        <>
          <Divider />
          <View style={[styles.section, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
            <InfoRow
              icon="location-outline"
              label="Lieu"
              value={`${booking.location.name}\n${booking.location.address}`}
            />
          </View>
        </>
      )}

      {/* Member Section (if provided) */}
      {booking.member && (
        <>
          <Divider />
          <View style={[styles.section, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
            <InfoRow
              icon="person-outline"
              label="Avec"
              value={booking.member.name}
            />
          </View>
        </>
      )}

      {/* Actions */}
      {(canCancel || canReview) && (
        <>
          <Divider />
          <View style={[styles.actions, { padding: spacing.lg, gap: spacing.sm }]}>
            {canCancel && onCancel && (
              <Button variant="outline" onPress={onCancel} title="Annuler la réservation" />
            )}
            {canReview && onReview && (
              <Button variant="primary" onPress={onReview} title="Laisser un avis" />
            )}
          </View>
        </>
      )}
    </View>
  );
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  bold?: boolean;
}

function InfoRow({ icon, label, value, bold }: InfoRowProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.infoRow, { marginBottom: spacing.sm }]}>
      <Ionicons
        name={icon}
        size={18}
        color={colors.primary}
        style={{ marginRight: spacing.sm }}
      />
      <Text variant="caption" color="textSecondary" style={{ minWidth: 80 }}>
        {label}
      </Text>
      <Text variant="body" style={[styles.infoValue, bold && styles.bold]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  section: {},
  statusRow: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  callButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    flex: 1,
  },
  bold: {
    fontWeight: '600',
  },
  actions: {},
});
