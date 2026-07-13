/**
 * ReviewCard Component
 * Display a single review with optional provider reply
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  /** Admin-imported external review → shows a neutral "Avis importé" badge.
   *  The source (Planity, etc.) is NEVER exposed publicly. */
  imported?: boolean;
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
  imported,
  reply,
}: ReviewCardProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  return (
    <Card padding="md" shadow="sm">
      {/* Header: Avatar + Name + Date */}
      <View style={[styles.header, { marginBottom: spacing.sm }]}>
        <Avatar size="md" name={authorName} />
        <View style={[styles.headerInfo, { marginLeft: spacing.sm }]}>
          <View style={styles.nameRow}>
            <Text variant="body" style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
            {imported && (
              <View style={[styles.importedBadge, { backgroundColor: colors.surfaceSecondary }]}>
                <Text variant="caption" color="textMuted" style={styles.importedBadgeText}>
                  {t('components.reviewCard.importedBadge')}
                </Text>
              </View>
            )}
          </View>
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
            {t('components.reviewCard.providerReply')}
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  authorName: {
    fontWeight: '600',
    flexShrink: 1,
  },
  importedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  importedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  replyContainer: {
    // Styles applied dynamically
  },
});
