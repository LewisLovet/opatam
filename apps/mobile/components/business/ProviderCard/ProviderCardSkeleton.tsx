/**
 * ProviderCardSkeleton Component
 * Skeleton loading state for ProviderCard
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';
import { Card } from '../../Card';
import { Skeleton } from '../../Loader';

export function ProviderCardSkeleton() {
  const { colors, spacing, radius } = useTheme();

  return (
    <Card padding="none" shadow="md" style={styles.card}>
      {/* Photo skeleton - use View with aspectRatio for proper sizing */}
      <View style={styles.imageContainer}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
      </View>

      {/* Content */}
      <View style={{ padding: spacing.md }}>
        {/* Business name skeleton */}
        <Skeleton width="70%" height={22} borderRadius={radius.sm} />

        {/* Category + City skeleton */}
        <Skeleton
          width="50%"
          height={14}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.sm }}
        />

        {/* Price skeleton */}
        <Skeleton
          width="35%"
          height={16}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
});
