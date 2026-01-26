/**
 * ProviderCard Component
 * Card displaying provider info for search results and suggestions
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Rating } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Card } from '../../Card';

export interface ProviderCardProps {
  /** Provider photo URL */
  photoURL: string | null;
  /** Provider/business name */
  businessName: string;
  /** Category name */
  category: string;
  /** City name (first city from cities array) */
  city: string;
  /** Rating object with average and count */
  rating: Rating;
  /** Minimum price in centimes (null if no services) */
  minPrice: number | null;
  /** Press handler */
  onPress: () => void;
}

/**
 * Format price from centimes to euros
 */
function formatPrice(centimes: number): string {
  const euros = centimes / 100;
  return euros % 1 === 0 ? `${euros}` : euros.toFixed(2);
}

export function ProviderCard({
  photoURL,
  businessName,
  category,
  city,
  rating,
  minPrice,
  onPress,
}: ProviderCardProps) {
  const { colors, spacing, radius } = useTheme();

  const hasRating = rating.count > 0;

  return (
    <Card padding="none" shadow="md" onPress={onPress} style={styles.card}>
      {/* Photo container */}
      <View style={styles.imageContainer}>
        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="storefront-outline" size={40} color={colors.textMuted} />
          </View>
        )}

        {/* Rating badge overlay - now includes review count */}
        {hasRating && (
          <View
            style={[
              styles.ratingBadge,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text variant="bodySmall" style={styles.ratingText}>
              {rating.average.toFixed(1)}
            </Text>
            <Text variant="caption" color="textMuted">
              ({rating.count})
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={[styles.content, { padding: spacing.md }]}>
        <Text variant="h3" numberOfLines={1} style={{ marginBottom: spacing.xs }}>
          {businessName}
        </Text>

        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {category} • {city}
        </Text>

        <View style={[styles.footer, { marginTop: spacing.sm }]}>
          {minPrice !== null ? (
            <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>
              À partir de {formatPrice(minPrice)} €
            </Text>
          ) : (
            <Text variant="bodySmall" color="textMuted">
              Prix sur demande
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontWeight: '600',
  },
  content: {
    // padding applied dynamically
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
