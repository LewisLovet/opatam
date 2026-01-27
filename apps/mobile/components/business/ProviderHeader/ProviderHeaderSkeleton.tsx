/**
 * ProviderHeaderSkeleton Component
 * Skeleton loading state for ProviderHeader
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { Skeleton } from '../../Loader';

const COVER_HEIGHT = 200;
const COVER_BORDER_RADIUS = 16;
const AVATAR_SIZE = 80;

export function ProviderHeaderSkeleton() {
  const { spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Cover Photo skeleton - extends under notch */}
      <Skeleton
        width="100%"
        height={COVER_HEIGHT + insets.top}
        borderRadius={0}
        style={{
          borderBottomLeftRadius: COVER_BORDER_RADIUS,
          borderBottomRightRadius: COVER_BORDER_RADIUS,
        }}
      />

      {/* Content with Avatar */}
      <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
        {/* Avatar skeleton */}
        <View style={{ marginTop: -40, alignItems: 'center' }}>
          <Skeleton circle height={AVATAR_SIZE} />
        </View>

        {/* Name skeleton */}
        <View style={{ alignItems: 'center', marginTop: spacing.md }}>
          <Skeleton width={180} height={24} borderRadius={radius.sm} />
        </View>

        {/* Category skeleton */}
        <View style={{ alignItems: 'center', marginTop: spacing.xs }}>
          <Skeleton width={100} height={14} borderRadius={radius.sm} />
        </View>

        {/* Rating skeleton */}
        <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
          <Skeleton width={80} height={16} borderRadius={radius.sm} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    alignItems: 'center',
  },
});
