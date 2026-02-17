/**
 * ProviderHeader Component
 * Hero section with smooth image loading via expo-image
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rating, getCategoryLabel } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';

export interface ProviderHeaderProps {
  /** Cover photo URL */
  coverPhotoURL: string | null;
  /** Avatar/profile photo URL */
  avatarURL: string | null;
  /** Provider/business name */
  businessName: string;
  /** Category name */
  category: string;
  /** Rating object with average and count */
  rating: Rating;
  /** Callback when rating is pressed */
  onRatingPress?: () => void;
}

const COVER_HEIGHT = 200;
const AVATAR_SIZE = 80;
const AVATAR_BORDER_WIDTH = 1.5;
const AVATAR_OVERLAP = 40;

// Placeholder blur hash
const PLACEHOLDER_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export function ProviderHeader({
  coverPhotoURL,
  avatarURL,
  businessName,
  category,
  rating,
  onRatingPress,
}: ProviderHeaderProps) {
  const { colors, spacing, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  const hasRating = rating.count > 0;
  const coverHeight = COVER_HEIGHT + insets.top;

  return (
    <View style={styles.container}>
      {/* Cover Photo */}
      <View
        style={[
          styles.coverContainer,
          {
            height: coverHeight,
          },
        ]}
      >
        {coverPhotoURL ? (
          <Image
            source={{ uri: coverPhotoURL }}
            style={styles.coverImage}
            contentFit="cover"
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            transition={400}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="storefront-outline" size={64} color={colors.primary} style={{ opacity: 0.4 }} />
          </View>
        )}
      </View>

      {/* Content with Avatar */}
      <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
        {/* Avatar */}
        <View
          style={[
            styles.avatarContainer,
            {
              marginTop: -AVATAR_OVERLAP,
              borderRadius: AVATAR_SIZE / 2,
              borderWidth: AVATAR_BORDER_WIDTH,
              borderColor: '#FFFFFF',
              ...shadows.md,
            },
          ]}
        >
          {avatarURL ? (
            <Image
              source={{ uri: avatarURL }}
              style={[
                styles.avatar,
                { borderRadius: (AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2) / 2 },
              ]}
              contentFit="cover"
              placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
              transition={300}
              cachePolicy="memory-disk"
            />
          ) : (
            <Avatar size="xl" name={businessName} />
          )}
        </View>

        {/* Name */}
        <Text variant="h2" align="center" style={{ marginTop: spacing.md }}>
          {businessName}
        </Text>

        {/* Category */}
        <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
          {getCategoryLabel(category)}
        </Text>

        {/* Rating */}
        {hasRating ? (
          <Pressable onPress={onRatingPress} style={[styles.ratingContainer, { marginTop: spacing.sm }]}>
            <Ionicons name="star" size={16} color="#FBBF24" />
            <Text variant="body" style={styles.ratingText}>
              {rating.average.toFixed(1)}
            </Text>
            <Text variant="bodySmall" color="textSecondary">
              ({rating.count} avis)
            </Text>
          </Pressable>
        ) : (
          <Text variant="bodySmall" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
            Pas encore d'avis
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  coverContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  avatar: {
    width: AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2,
    height: AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontWeight: '600',
  },
});
