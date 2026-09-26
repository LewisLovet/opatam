/**
 * BookingSummary Component
 * Displays a summary card with service info for the booking flow
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import { formatPrice } from '@booking-app/shared';

export interface BookingSummaryProps {
  /** Service name */
  serviceName: string;
  /** Duration in minutes */
  duration: number;
  /** Price in cents */
  price: number;
  /** Provider name */
  providerName: string;
  /** Provider photo URL (optional) */
  providerPhotoURL?: string | null;
  /** Member name (optional) */
  memberName?: string | null;
  /**
   * Devise du prestataire consulte. Absente = euro, pour la compatibilite.
   *
   * Passee en propriete et non lue dans un module : ce composant sert le
   * tunnel CLIENT, ou la devise est celle du prestataire qu'on reserve, pas
   * celle du prestataire connecte.
   */
  currency?: string | null;
}

export function BookingSummary({
  serviceName,
  duration,
  price,
  providerName,
  providerPhotoURL,
  memberName,
  currency,
}: BookingSummaryProps) {
  const { colors, spacing, radius } = useTheme();

  const formattedPrice = formatPrice(price, currency);

  // Format duration
  const formattedDuration = duration >= 60
    ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? duration % 60 : ''}`
    : `${duration} min`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          borderRadius: radius.xl,
          padding: spacing.md,
        },
      ]}
    >
      {/* Service info */}
      <View style={styles.mainRow}>
        <Avatar
          size="md"
          name={providerName}
          imageUrl={providerPhotoURL}
          style={styles.avatar}
        />
        <View style={styles.content}>
          <Text variant="body" style={styles.serviceName}>
            {serviceName}
          </Text>
          <Text variant="caption" style={styles.providerName}>
            {providerName}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text variant="h3" style={styles.price}>
            {formattedPrice}
          </Text>
        </View>
      </View>

      {/* Details row */}
      <View style={[styles.detailsRow, { marginTop: spacing.sm }]}>
        <View style={styles.detailChip}>
          <Ionicons name="time-outline" size={14} color="#FFFFFF" />
          <Text variant="caption" style={styles.detailText}>
            {formattedDuration}
          </Text>
        </View>

        {memberName && (
          <View style={styles.detailChip}>
            <Ionicons name="person-outline" size={14} color="#FFFFFF" />
            <Text variant="caption" style={styles.detailText}>
              {memberName}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    flex: 1,
  },
  serviceName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  providerName: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  priceContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  price: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  detailText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
