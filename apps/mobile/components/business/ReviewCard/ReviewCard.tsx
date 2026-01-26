/**
 * ReviewCard Component
 * Display a single review with optional provider reply
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import { Card } from '../../Card';
import { StarRating } from '../StarRating';
import { formatRelativeDate } from '../../../utils/formatDate';

export interface ReviewCardProps {
  /** Author display name */
  authorName: string;
  /** Author initials for avatar (optional, derived from name if not provided) */
  authorInitials?: string;
  /** Rating (1-5) */
  rating: number;
  /** Review comment (can be null for rating-only reviews) */
  comment: string | null;
  /** Review date */
  date: Date;
  /** Provider reply (optional) */
  reply?: {
    text: string;
    date: Date;
  } | null;
}

export function ReviewCard({
  authorName,
  authorInitials,
  rating,
  comment,
  date,
  reply,
}: ReviewCardProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Card padding="md" shadow="sm">
      {/* Header: Avatar + Name + Date */}
      <View style={[styles.header, { marginBottom: spacing.sm }]}>
        <Avatar size="md" name={authorName} />
        <View style={[styles.headerInfo, { marginLeft: spacing.sm }]}>
          <Text variant="body" style={styles.authorName}>
            {authorName}
          </Text>
          <Text variant="caption" color="textMuted">
            {formatRelativeDate(date)}
          </Text>
        </View>
      </View>

      {/* Star Rating */}
      <View style={{ marginBottom: comment ? spacing.sm : 0 }}>
        <StarRating rating={rating} size="sm" />
      </View>

      {/* Comment */}
      {comment && (
        <Text variant="body" color="textSecondary">
          {comment}
        </Text>
      )}

      {/* Provider Reply */}
      {reply && (
        <View
          style={[
            styles.replyContainer,
            {
              marginTop: spacing.md,
              padding: spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.md,
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
            },
          ]}
        >
          <Text variant="label" color="primary" style={{ marginBottom: spacing.xs }}>
            Réponse du prestataire
          </Text>
          <Text variant="body" color="textSecondary">
            {reply.text}
          </Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
            {formatRelativeDate(reply.date)}
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  authorName: {
    fontWeight: '600',
  },
  replyContainer: {
    // Styles applied dynamically
  },
});
