/**
 * ProviderCard Component
 * Card displaying provider info with smooth image loading via expo-image
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
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
  /** Next available slot (Firestore Date or null) */
  nextAvailableSlot?: Date | null;
  /** Distance in km (from user location) */
  distance?: number;
  /** Whether the provider is verified */
  isVerified?: boolean;
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

function formatNextAvailable(date: any): string | null {
  if (!date) return null;
  // Handle Firestore Timestamp, Date, or ISO string
  const d = date?.toDate ? date.toDate() : date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (dateOnly < today) return null; // passé
  if (dateOnly.getTime() === today.getTime()) return "Aujourd'hui";
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Demain';

  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function ProviderCard({
  photoURL,
  businessName,
  category,
  city,
  rating,
  minPrice,
  nextAvailableSlot,
  distance,
  isVerified = false,
  onPress,
  isLoading = false,
}: ProviderCardProps) {
  const { colors, spacing, radius } = useTheme();

  const hasRating = rating.count > 0;
  const hasValidPrice = minPrice != null && !isNaN(minPrice) && minPrice >= 0;
  const nextAvailFormatted = formatNextAvailable(nextAvailableSlot);

  // Loading animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoading) {
      // Progress bar sweep
      const progress = Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      );
      // Subtle pulse
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.85, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      progress.start();
      pulse.start();
      return () => {
        progress.stop();
        pulse.stop();
      };
    } else {
      progressAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [isLoading, progressAnim, pulseAnim]);

  return (
    <Animated.View style={{ opacity: isLoading ? pulseAnim : 1 }}>
    <Card padding="none" shadow="md" onPress={onPress} style={styles.card}>
      {/* Loading progress bar */}
      {isLoading && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: colors.primary,
                transform: [{
                  translateX: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-200, 400],
                  }),
                }],
              },
            ]}
          />
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
        <View style={styles.nameRow}>
          <Text variant="h3" numberOfLines={1} style={{ flex: 1 }}>
            {businessName}
          </Text>
          {isVerified && (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          )}
        </View>

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
          {nextAvailFormatted && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="calendar-outline" size={12} color={colors.success || '#16a34a'} />
              <Text variant="caption" style={{ fontWeight: '600', color: colors.success || '#16a34a', fontSize: 11 }}>
                {nextAvailFormatted}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 10,
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  progressBar: {
    width: 120,
    height: 3,
    borderRadius: 2,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
