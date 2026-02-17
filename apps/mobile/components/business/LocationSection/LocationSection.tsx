/**
 * LocationSection Component
 * Displays all provider locations with type icons, addresses,
 * and click-to-navigate for fixed locations with street addresses.
 */

import React from 'react';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import type { Location } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface LocationSectionProps {
  locations: WithId<Location>[];
}

export function LocationSection({ locations }: LocationSectionProps) {
  const { colors, spacing, radius } = useTheme();

  if (locations.length === 0) return null;

  const headerLabel = locations.length === 1 ? 'Lieu' : 'Lieux';

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={[styles.header, { marginBottom: spacing.sm }]}>
        <Ionicons
          name="location-outline"
          size={20}
          color={colors.primary}
          style={{ marginRight: spacing.sm }}
        />
        <Text variant="h3">{headerLabel}</Text>
      </View>

      {/* Location cards */}
      <View style={{ gap: spacing.sm }}>
        {locations.map((location) => (
          <LocationCard key={location.id} location={location} />
        ))}
      </View>
    </View>
  );
}

// ─── Location Card ───────────────────────────────────────────────────────────

interface LocationCardProps {
  location: WithId<Location>;
}

function LocationCard({ location }: LocationCardProps) {
  const { colors, spacing, radius } = useTheme();

  const isFixed = location.type === 'fixed';
  const isMobile = location.type === 'mobile';
  const icon: keyof typeof Ionicons.glyphMap = isFixed ? 'business-outline' : 'car-outline';

  const hasStreetAddress = !!location.address?.trim();
  const fullAddress = hasStreetAddress
    ? `${location.address}, ${location.city} ${location.postalCode}`
    : `${location.city} ${location.postalCode}`;

  const handleAddressPress = () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    Linking.openURL(mapsUrl);
  };

  const isTappable = isFixed && hasStreetAddress;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.cardRow}>
        {/* Type icon */}
        <Ionicons
          name={icon}
          size={22}
          color={colors.primary}
          style={{ marginRight: spacing.md }}
        />

        {/* Content */}
        <View style={styles.cardContent}>
          {/* Location name */}
          <Text variant="body" style={styles.locationName}>
            {location.name}
          </Text>

          {/* Address */}
          {isTappable ? (
            <Pressable
              onPress={handleAddressPress}
              style={({ pressed }) => [
                styles.addressRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text variant="bodySmall" color="primary">
                {fullAddress}
              </Text>
              <Ionicons
                name="open-outline"
                size={12}
                color={colors.primary}
                style={{ marginLeft: spacing.xs }}
              />
            </Pressable>
          ) : (
            <Text variant="bodySmall" color="textSecondary">
              {fullAddress}
            </Text>
          )}

          {/* Travel radius for mobile locations */}
          {isMobile && location.travelRadius != null && (
            <Text
              variant="caption"
              color="textSecondary"
              style={{ marginTop: spacing.xs }}
            >
              Rayon de d{'\u00E9'}placement : {location.travelRadius} km
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    // dynamic styles applied inline
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardContent: {
    flex: 1,
  },
  locationName: {
    fontWeight: '600',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
});
