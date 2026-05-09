/**
 * RelatedArticles
 *
 * "Articles similaires" block at the bottom of an article detail
 * screen. Same-category siblings, up to 3 by default — mirrors the
 * web blog suggestion strip so providers get a consistent reading
 * trail across surfaces.
 *
 * Renders nothing when there are zero related items (avoids the
 * lonely "Articles similaires" header with an empty space below).
 *
 * Cards are intentionally compact: cover thumbnail (16/9, with the
 * maxres → hq fallback baked into <YouTubeThumbnail>), category
 * pill, title (2 lines max). No excerpt — the goal is discovery,
 * not full preview, and we want to keep this block short so it
 * doesn't dwarf the article the user just read.
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ARTICLE_CATEGORY_LABELS,
  extractYouTubeId,
  type Article,
} from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { Text, Card } from '../..';
import { useTheme } from '../../../theme';
import { YouTubeThumbnail } from './YouTubeThumbnail';

interface Props {
  articles: WithId<Article>[];
  /**
   * Optional outer wrapper style — useful when the parent screen
   * already has its own padding and we just need to control margins.
   */
  style?: StyleProp<ViewStyle>;
}

export function RelatedArticles({ articles, style }: Props) {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  if (articles.length === 0) return null;

  return (
    <View style={[{ marginTop: spacing.xl, gap: spacing.md }, style]}>
      <Text
        variant="caption"
        color="textSecondary"
        style={{
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Articles similaires
      </Text>

      <View style={{ gap: spacing.md }}>
        {articles.map((a) => (
          <Pressable
            key={a.id}
            onPress={() =>
              // Replace rather than push so the back button still
              // returns to the original list, not through a chain
              // of related articles. Matches typical blog UX.
              router.replace(`/(pro)/help/${a.slug}` as any)
            }
          >
            {({ pressed }) => (
              <Card padding="none" style={{ opacity: pressed ? 0.9 : 1 }}>
                <RelatedCardCover article={a} />
                <View style={{ padding: spacing.md, gap: 6 }}>
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
                      {ARTICLE_CATEGORY_LABELS[a.category]}
                    </Text>
                  </View>
                  <Text
                    variant="body"
                    style={{ fontWeight: '700', lineHeight: 22 }}
                    numberOfLines={2}
                  >
                    {a.title}
                  </Text>
                </View>
              </Card>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Cover renderer — picks between the custom upload and the
 * YouTube auto-thumb (maxres-with-fallback). Returns nothing
 * when neither source is available, so the card just shows
 * its text body — better than a grey rectangle.
 */
function RelatedCardCover({ article }: { article: WithId<Article> }) {
  if (article.coverImageURL) {
    return (
      <Image
        source={{ uri: article.coverImageURL }}
        style={styles.cover}
        resizeMode="cover"
      />
    );
  }
  if (article.videoUrl && extractYouTubeId(article.videoUrl)) {
    return <YouTubeThumbnail videoUrl={article.videoUrl} style={styles.cover} />;
  }
  return null;
}

const styles = StyleSheet.create({
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
});
