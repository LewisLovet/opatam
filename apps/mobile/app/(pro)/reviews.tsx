/**
 * Reviews Management Screen
 * View all reviews (public + private), filter by rating/member,
 * toggle visibility, delete reviews.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import {
  reviewRepository,
  memberRepository,
  type WithId,
} from '@booking-app/firebase';
import type { Review, Member } from '@booking-app/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | any): string {
  const d = date instanceof Date ? date : date?.toDate?.() ?? new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Star rating display
function Stars({
  rating,
  size = 14,
  color = '#F59E0B',
}: {
  rating: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? color : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Distribution Bar
// ---------------------------------------------------------------------------

function RatingBar({
  star,
  count,
  total,
  colors,
}: {
  star: number;
  count: number;
  total: number;
  colors: any;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.ratingBarRow}>
      <Text variant="caption" color="textSecondary" style={styles.ratingBarLabel}>
        {star}
      </Text>
      <Ionicons name="star" size={10} color="#F59E0B" />
      <View style={[styles.ratingBarTrack, { backgroundColor: colors.surfaceSecondary }]}>
        <View
          style={[
            styles.ratingBarFill,
            { width: `${pct}%`, backgroundColor: '#F59E0B' },
          ]}
        />
      </View>
      <Text variant="caption" color="textMuted" style={styles.ratingBarCount}>
        {count}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ReviewsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId } = useProvider();

  const [reviews, setReviews] = useState<WithId<Review>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterMember, setFilterMember] = useState<string | null>(null);

  // Rating stats from provider
  const rating = provider?.rating || { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const [allReviews, mbrs] = await Promise.all([
        reviewRepository.getAllByProvider(providerId),
        memberRepository.getActiveByProvider(providerId),
      ]);
      setReviews(allReviews);
      setMembers(mbrs);
    } catch (err) {
      console.error('Error loading reviews:', err);
      showToast({ variant: 'error', message: 'Erreur lors du chargement des avis' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---------------------------------------------------------------------------
  // Filtered reviews
  // ---------------------------------------------------------------------------

  const filteredReviews = reviews.filter((r) => {
    if (filterRating && r.rating !== filterRating) return false;
    if (filterMember && r.memberId !== filterMember) return false;
    return true;
  });

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return null;
    return members.find((m) => m.id === memberId)?.name || null;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ fontWeight: '600' }}>
            Avis clients
          </Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats Card ── */}
        <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
          <View style={styles.statsContainer}>
            {/* Left: Big average */}
            <View style={styles.statsLeft}>
              <Text variant="h1" style={{ fontSize: 48, fontWeight: '700', lineHeight: 52 }}>
                {rating.average > 0 ? rating.average.toFixed(1) : '–'}
              </Text>
              <Stars rating={Math.round(rating.average)} size={18} />
              <Text variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                {rating.count} avis
              </Text>
            </View>

            {/* Right: Distribution bars */}
            <View style={styles.statsRight}>
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar
                  key={star}
                  star={star}
                  count={rating.distribution?.[star as keyof typeof rating.distribution] || 0}
                  total={rating.count}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        </Card>

        {/* ── Filters ── */}
        <View style={{ marginBottom: spacing.lg }}>
          {/* Rating filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            <Pressable
              onPress={() => setFilterRating(null)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: filterRating === null ? colors.primary : colors.surface,
                  borderColor: filterRating === null ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                variant="bodySmall"
                style={{
                  fontWeight: '600',
                  color: filterRating === null ? '#FFFFFF' : colors.text,
                }}
              >
                Tous ({reviews.length})
              </Text>
            </Pressable>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              return (
                <Pressable
                  key={star}
                  onPress={() => setFilterRating(filterRating === star ? null : star)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: filterRating === star ? colors.primary : colors.surface,
                      borderColor: filterRating === star ? colors.primary : colors.border,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Ionicons
                    name="star"
                    size={12}
                    color={filterRating === star ? '#FFFFFF' : '#F59E0B'}
                  />
                  <Text
                    variant="bodySmall"
                    style={{
                      fontWeight: '600',
                      color: filterRating === star ? '#FFFFFF' : colors.text,
                    }}
                  >
                    {star} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Member filter (only if >1 member) */}
          {members.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.sm }}
            >
              <Pressable
                onPress={() => setFilterMember(null)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filterMember === null ? colors.primary : colors.surface,
                    borderColor: filterMember === null ? colors.primary : colors.border,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={{
                    fontWeight: '600',
                    color: filterMember === null ? '#FFFFFF' : colors.text,
                  }}
                >
                  Tous les membres
                </Text>
              </Pressable>
              {members.map((mbr) => (
                <Pressable
                  key={mbr.id}
                  onPress={() => setFilterMember(filterMember === mbr.id ? null : mbr.id)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: filterMember === mbr.id ? colors.primary : colors.surface,
                      borderColor: filterMember === mbr.id ? colors.primary : colors.border,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.memberDot,
                      { backgroundColor: filterMember === mbr.id ? '#FFFFFF' : (mbr.color || colors.primary) },
                    ]}
                  />
                  <Text
                    variant="bodySmall"
                    style={{
                      fontWeight: '600',
                      color: filterMember === mbr.id ? '#FFFFFF' : colors.text,
                    }}
                  >
                    {mbr.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Reviews List ── */}
        {filteredReviews.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.primary} />
            </View>
            <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
              {reviews.length === 0 ? 'Aucun avis' : 'Aucun résultat'}
            </Text>
            <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
              {reviews.length === 0
                ? 'Vos clients pourront laisser des avis après leurs rendez-vous.'
                : 'Modifiez les filtres pour voir d\'autres avis.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {filteredReviews.map((review) => (
              <Card key={review.id} padding="lg" shadow="sm">
                {/* Header: Avatar + Name + Date */}
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewHeaderLeft}>
                    {review.clientPhoto ? (
                      <Image
                        source={{ uri: review.clientPhoto }}
                        style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}
                      />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                        <Text variant="bodySmall" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                          {getInitials(review.clientName)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text variant="body" style={{ fontWeight: '600' }}>
                        {review.clientName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                        <Stars rating={review.rating} size={12} />
                        <Text variant="caption" color="textMuted">
                          {formatDate(review.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Member badge */}
                {review.memberId && getMemberName(review.memberId) && (() => {
                  const mbr = members.find((m) => m.id === review.memberId);
                  const mbrColor = mbr?.color || colors.primary;
                  return (
                    <View style={[styles.memberBadge, { backgroundColor: mbrColor + '15' }]}>
                      <View style={[styles.memberBadgeDot, { backgroundColor: mbrColor }]} />
                      <Text variant="caption" style={{ color: mbrColor, fontWeight: '600' }}>
                        {getMemberName(review.memberId)}
                      </Text>
                    </View>
                  );
                })()}

                {/* Comment */}
                {review.comment && (
                  <Text variant="body" color="textSecondary" style={{ marginTop: spacing.sm, lineHeight: 20 }}>
                    {review.comment}
                  </Text>
                )}
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { borderBottomWidth: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsLeft: {
    alignItems: 'center',
    marginRight: 24,
    minWidth: 80,
  },
  statsRight: {
    flex: 1,
    gap: 4,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingBarLabel: {
    width: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  ratingBarCount: {
    width: 24,
    textAlign: 'right',
  },
  // Filters
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Review card
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  memberBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
