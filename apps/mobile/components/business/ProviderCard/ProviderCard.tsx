/**
 * ProviderCard Component
 * Card displaying provider info with smooth image loading via expo-image
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Rating, formatDistance, getCategoryLabel, capitalizeWords } from '@booking-app/shared';
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
  /** Distance in km (from user location) */
  distance?: number;
  /** Press handler */
  onPress: () => void;
  /** Show loading overlay (for navigation preloading) */
  isLoading?: boolean;
}

// Placeholder blur hash (gray blur)
const PLACEHOLDER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

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
  distance,
  onPress,
  isLoading = false,
}: ProviderCardProps) {
  const { colors, spacing, radius } = useTheme();

  const hasRating = rating.count > 0;
  const hasValidPrice = minPrice != null && !isNaN(minPrice) && minPrice >= 0;

  return (
    <Card padding="none" shadow="md" onPress={onPress} style={[styles.card, isLoading && styles.cardLoading]}>
      {/* Loading overlay */}
      {isLoading && (
        <View style={[styles.loadingOverlay, { borderRadius: radius.lg }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Photo container */}
      <View style={styles.imageContainer}>
        {photoURL ? (
          <Image
            source={{ uri: photoURL }}
            style={styles.image}
            contentFit="cover"
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            transition={300}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="storefront-outline" size={40} color={colors.textMuted} />
          </View>
        )}

        {/* Rating badge overlay */}
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
          {getCategoryLabel(category)} • {capitalizeWords(city)}{distance != null && distance !== Infinity ? ` • ${formatDistance(distance)}` : ''}
        </Text>

        <View style={[styles.footer, { marginTop: spacing.sm }]}>
          {hasValidPrice ? (
            <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>
              {minPrice === 0 ? 'Gratuit' : `À partir de ${formatPrice(minPrice)} €`}
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
  cardLoading: {
    opacity: 0.7,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  content: {},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
