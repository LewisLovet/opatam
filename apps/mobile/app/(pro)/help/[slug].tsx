/**
 * Pro — Article detail
 *
 * Renders a single published article (tutoriel, conseil, témoignage)
 * for in-app reading.
 *
 * Layout, top to bottom:
 *   - Persistent top bar (back + share button) — sits ABOVE the
 *     iOS status bar and Dynamic Island so the floating-button
 *     overlap bug from the previous version can't recur
 *   - Cover image (or YouTube thumbnail) — full-bleed below the bar
 *   - Title + meta (category pill, author, published date)
 *   - Excerpt as a lead paragraph
 *   - Inline collapsible Sommaire (auto-hidden if < 2 headings)
 *   - Optional embedded YouTube video (lite-thumbnail, opens
 *     externally on tap — see ArticleVideo.tsx)
 *   - Markdown body
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Share,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import i18n from '../../../lib/i18n';
import { Text, Loader, EmptyState } from '../../../components';
import { BrandedHeader } from '../../../components/business/BrandedHeader';
import { useArticle, useRelatedArticles } from '../../../hooks';
import {
  extractHeadings,
  type Heading,
} from '@booking-app/shared';
import { MarkdownView } from '../../../components/business/Article/MarkdownView';
import { ArticleVideo } from '../../../components/business/Article/ArticleVideo';
import { Sommaire } from '../../../components/business/Article/Sommaire';
import { SommaireDrawer } from '../../../components/business/Article/SommaireDrawer';
import { RelatedArticles } from '../../../components/business/Article/RelatedArticles';

export default function ArticleDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { article, loading, error } = useArticle(slug);
  // Same-category siblings — empty until the source article loads.
  const { related } = useRelatedArticles(article);

  // Headings extracted from the markdown body for the Sommaire.
  const headings: Heading[] = React.useMemo(
    () => (article?.body ? extractHeadings(article.body) : []),
    [article?.body],
  );

  // ScrollView ref + heading-position map for tap-to-scroll.
  // The MarkdownView reports onLayout for each heading; we store
  // the y-offset relative to the markdown container, then add the
  // markdown container's own offset inside the page when jumping.
  const scrollRef = React.useRef<ScrollView | null>(null);
  const headingPositionsRef = React.useRef<Map<string, number>>(new Map());
  const markdownTopRef = React.useRef<number>(0);

  const handleHeadingLayout = React.useCallback((s: string, y: number) => {
    headingPositionsRef.current.set(s, y);
  }, []);

  // Drawer state — controlled by the burger button in the header.
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Share the public web URL — NOT an app deep link, so the
  // recipient can open it in any browser without installing
  // Opatam. Same canonical URL the web blog uses (see
  // apps/web/app/blog/[slug]/page.tsx). The article repository is
  // shared between web and mobile, so the slug always resolves on
  // the web side.
  const handleShare = React.useCallback(async () => {
    if (!article) return;
    const url = `https://opatam.com/blog/${article.slug}`;
    try {
      await Share.share({
        // iOS uses `url`, Android folds the URL into `message` —
        // setting both gives a clean preview on iOS while keeping
        // the link visible in Android share sheets that don't
        // honour the url field.
        url,
        message: `${article.title}\n${url}`,
        title: article.title,
      });
    } catch {
      // Share dialogs cancel by throwing — silently ignored.
    }
  }, [article]);

  const jumpTo = React.useCallback(
    (s: string) => {
      const yWithinMarkdown = headingPositionsRef.current.get(s);
      if (yWithinMarkdown == null || !scrollRef.current) return;
      // Total y = where the markdown container sits in the page +
      // the heading's offset within it. Subtract a small padding so
      // the heading doesn't sit flush against the sticky header.
      const target = Math.max(0, markdownTopRef.current + yWithinMarkdown - 12);
      scrollRef.current.scrollTo({ y: target, animated: true });
    },
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Branded blue header — same chrome as every other pro
          screen. Two right-side actions:
            - share: opens the OS share sheet with the public web
              URL of the article (so recipients without the app
              still land on opatam.com/blog/<slug>).
            - burger: opens the TOC drawer. Hidden when the article
              has no headings to surface, so we don't tease an
              empty drawer. */}
      <BrandedHeader
        title={
          article && article.category
            ? t(`proHelp.categories.${article.category}`)
            : t('proHelp.articleFallbackTitle')
        }
        secondaryRightAction={
          article
            ? {
                icon: 'share-outline',
                onPress: handleShare,
                accessibilityLabel: t('proHelp.shareArticle'),
              }
            : undefined
        }
        rightAction={
          headings.length > 0
            ? {
                icon: 'menu-outline',
                onPress: () => setDrawerOpen(true),
                accessibilityLabel: t('proHelp.tocLabel'),
              }
            : undefined
        }
      />

      {loading ? (
        <View style={styles.center}>
          <Loader />
        </View>
      ) : error || !article ? (
        <View style={[styles.center, { paddingHorizontal: spacing.lg }]}>
          <EmptyState
            icon="document-text-outline"
            title={t('proHelp.notFoundTitle')}
            description={error ?? t('proHelp.notFoundDescription')}
          />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing['2xl'],
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover — full-bleed below the top bar. Hero-style. */}
          {article.coverImageURL && (
            <Image
              source={{ uri: article.coverImageURL }}
              style={styles.cover}
              resizeMode="cover"
            />
          )}

          {/* Body padding wrapper */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              gap: spacing.sm,
            }}
          >
            {/* Category pill */}
            <View
              style={[
                styles.categoryPill,
                { backgroundColor: colors.primary + '20' },
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
                {t(`proHelp.categories.${article.category}`)}
              </Text>
            </View>

            {/* Title */}
            <Text variant="h1" style={{ marginTop: spacing.xs, lineHeight: 32 }}>
              {article.title}
            </Text>

            {/* Meta row — author + published date */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginTop: spacing.xs,
                marginBottom: spacing.md,
              }}
            >
              {article.authorPhotoURL ? (
                <Image
                  source={{ uri: article.authorPhotoURL }}
                  style={styles.authorAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.authorAvatar,
                    {
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                    {article.authorName?.charAt(0) || 'O'}
                  </Text>
                </View>
              )}
              <Text variant="caption" color="textSecondary">
                {article.authorName || t('proHelp.authorFallback')}
                {article.publishedAt
                  ? ` · ${formatPublishedDate(article.publishedAt)}`
                  : ''}
              </Text>
            </View>

            {/* Lead — excerpt as a slightly larger paragraph */}
            {article.excerpt && (
              <Text
                variant="body"
                color="textSecondary"
                style={{
                  fontSize: 16,
                  lineHeight: 24,
                  marginBottom: spacing.md,
                  fontStyle: 'italic',
                }}
              >
                {article.excerpt}
              </Text>
            )}

            {/* Inline sommaire — auto-hidden when article has < 2 headings */}
            <Sommaire headings={headings} onJump={jumpTo} />

            {/* Optional video — lite-thumbnail, tap opens YouTube */}
            {article.videoUrl && (
              <ArticleVideo
                url={article.videoUrl}
                coverUrl={article.videoCoverURL}
              />
            )}

            {/* Markdown body — wrapped so we can capture its y-offset
                in the page for tap-to-scroll, and let MarkdownView
                report each heading's relative offset within. */}
            <View
              onLayout={(e) => {
                markdownTopRef.current = e.nativeEvent.layout.y;
              }}
            >
              <MarkdownView
                body={article.body || ''}
                onHeadingLayout={handleHeadingLayout}
              />
            </View>

            {/* Articles similaires — same-category siblings, up
                to 3. Component renders nothing when the list is
                empty so a freshly-published article doesn't show
                a lonely "Articles similaires" header. */}
            <RelatedArticles articles={related} />
          </View>
        </ScrollView>
      )}

      {/* Side drawer with the full TOC — opens via the burger button
          in the header. Lives at the root of the screen so its
          modal/backdrop covers everything (header included). */}
      <SommaireDrawer
        visible={drawerOpen}
        headings={headings}
        onClose={() => setDrawerOpen(false)}
        onJump={jumpTo}
      />
    </View>
  );
}

/** "12 mai 2026" — same long format the web blog uses. */
function formatPublishedDate(d: Date | { toDate: () => Date } | string): string {
  const date =
    typeof d === 'string'
      ? new Date(d)
      : 'toDate' in d
        ? d.toDate()
        : d;
  return date.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
