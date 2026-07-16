/**
 * Pro — Tutoriels & guides
 *
 * In-app reading view of the articles published from the admin web
 * back-office. By default scoped to the `tutoriels` category, with
 * a chip toggle to also surface `conseils` (advice for growing the
 * business). `temoignages` (marketing testimonials) are
 * intentionally excluded — they target prospects, not active pros.
 *
 * The articles collection is shared with the public web blog at
 * /blog, so a single CMS push reaches both surfaces. No mobile-
 * specific publishing pipeline needed.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text, Card, Loader, EmptyState } from '../../../components';
import { BrandedHeader } from '../../../components/business/BrandedHeader';
import { YouTubeThumbnail } from '../../../components/business/Article/YouTubeThumbnail';
import {
  useArticles,
  useNewArticles,
  isArticleNew,
} from '../../../hooks';
import type { ArticleCategory } from '@booking-app/shared';
import { extractYouTubeId } from '@booking-app/shared';

type CategoryFilter = ArticleCategory | 'all';

export default function HelpScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Default to tutoriels — the most directly useful category for
  // an in-product help surface. The chip strip lets the pro flip
  // to conseils for broader business advice.
  const [filter, setFilter] = useState<CategoryFilter>('tutoriels');
  const categoryArg = filter === 'all' ? undefined : filter;
  const { articles, loading, error } = useArticles(categoryArg);

  // Mark the help section as visited on mount — that flips the
  // "Nouveau" pill on the Plus → Tutoriels & guides entry off
  // until a fresher article is published. Done in an effect (not
  // on header press) so navigating in via deep link, drawer, etc.
  // also clears it.
  const { markVisited } = useNewArticles();
  useEffect(() => {
    markVisited();
  }, [markVisited]);

  // Drop testimonials when "all" is selected — they're for prospects,
  // not for in-app consumption.
  const filtered = useMemo(
    () =>
      filter === 'all'
        ? articles.filter((a) => a.category !== 'temoignages')
        : articles,
    [articles, filter],
  );

  const refreshing = false; // hook re-fires on filter change; no manual pull-to-refresh need yet
  const onRefresh = () => {};

  const filterChips: { value: CategoryFilter; label: string }[] = [
    { value: 'tutoriels', label: t('proHelp.categories.tutoriels') },
    { value: 'conseils', label: t('proHelp.categories.conseils') },
    { value: 'all', label: t('proHelp.categories.all') },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Branded blue header — matches the rest of the pro space.
          Subtitle gives the screen its short value-prop. */}
      <BrandedHeader
        title={t('proHelp.title')}
        subtitle={t('proHelp.subtitle')}
      />

      {/* Category chips — wrapped in a fixed-height View so the
          horizontal ScrollView gets a stable layout box. Without
          the wrapper the ScrollView could collapse to 0 height
          inside the flex column, clipping the chips' text. */}
      <View style={{ paddingVertical: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          {filterChips.map((c) => {
            const active = filter === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setFilter(c.value)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? '#FFFFFF' : colors.text,
                    fontWeight: '600',
                    fontSize: 13,
                    lineHeight: 16,
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <Loader />
        </View>
      ) : error ? (
        <View style={[styles.center, { paddingHorizontal: spacing.lg }]}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t('proHelp.loadErrorTitle')}
            description={error}
          />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.center, { paddingHorizontal: spacing.lg }]}>
          <EmptyState
            icon="book-outline"
            title={t('proHelp.emptyTitle')}
            description={t('proHelp.emptyDescription')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
            gap: spacing.md,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filtered.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/(pro)/help/${a.slug}` as any)}
            >
              {({ pressed }) => (
                <Card padding="none" style={{ opacity: pressed ? 0.9 : 1 }}>
                  {/* Cover image. Custom uploads win; otherwise fall
                      back to the YouTube auto-thumbnail. The dedicated
                      YouTubeThumbnail component tries the 1280×720
                      maxres URL first and only steps down to the
                      480×360 hq variant on 404, so Retina cards stay
                      sharp. */}
                  {a.coverImageURL ? (
                    <Image
                      source={{ uri: a.coverImageURL }}
                      style={styles.coverImg}
                      resizeMode="cover"
                    />
                  ) : a.videoUrl && extractYouTubeId(a.videoUrl) ? (
                    <YouTubeThumbnail
                      videoUrl={a.videoUrl}
                      style={styles.coverImg}
                    />
                  ) : null}
                  <View style={{ padding: spacing.md, gap: 6 }}>
                    {/* Category pill (+ optional "Nouveau" / "Vidéo"
                        chips on the same row). The "Nouveau" chip
                        is purely time-based — see isArticleNew —
                        so old posts naturally lose it without us
                        having to track per-user reads. */}
                    <View style={styles.categoryPillRow}>
                      <View
                        style={[
                          styles.categoryPill,
                          {
                            backgroundColor: colors.primary + '20',
                          },
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={{
                            color: colors.primary,
                            fontWeight: '700',
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          {t(`proHelp.categories.${a.category}`)}
                        </Text>
                      </View>
                      {isArticleNew(a.publishedAt) && (
                        <View
                          style={[
                            styles.categoryPill,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Ionicons name="sparkles" size={9} color="#FFFFFF" />
                          <Text
                            variant="caption"
                            style={{
                              color: '#FFFFFF',
                              fontWeight: '800',
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: 0.4,
                            }}
                          >
                            {t('proHelp.newBadge')}
                          </Text>
                        </View>
                      )}
                      {a.videoUrl && (
                        <View
                          style={[
                            styles.categoryPill,
                            { backgroundColor: '#FEE2E2' },
                          ]}
                        >
                          <Ionicons name="play" size={9} color="#DC2626" />
                          <Text
                            variant="caption"
                            style={{
                              color: '#DC2626',
                              fontWeight: '700',
                              fontSize: 10,
                            }}
                          >
                            {t('proHelp.videoBadge')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text variant="body" style={{ fontWeight: '700', lineHeight: 22 }} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
                      {a.excerpt}
                    </Text>
                  </View>
                </Card>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    // Explicit height so the pill renders identically across
    // text variants and dynamic-type settings (the previous
    // paddingVertical-only approach left the text clipped on
    // some devices).
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  categoryPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
