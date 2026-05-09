/**
 * useArticles + useArticle Hooks
 *
 * Reads from the cross-platform `articleRepository` already used by
 * the public web blog. Two flavours:
 *  - `useArticles(category?)` → list of published articles, optionally
 *    filtered by category. Sorted newest first by publishedAt.
 *  - `useArticle(slug)` → single article by slug. Used by the detail
 *    screen.
 *
 * Cheap to call: a single Firestore query each, no aggregation,
 * articles barely change so we don't bother with caching.
 */

import { useEffect, useState } from 'react';
import {
  articleRepository,
  type WithId,
} from '@booking-app/firebase';
import type { Article, ArticleCategory } from '@booking-app/shared';

interface ArticlesState {
  articles: WithId<Article>[];
  loading: boolean;
  error: string | null;
}

export function useArticles(category?: ArticleCategory): ArticlesState {
  const [state, setState] = useState<ArticlesState>({
    articles: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const rows = category
          ? await articleRepository.getPublishedByCategory(category)
          : await articleRepository.getPublished();
        if (!cancelled) {
          setState({ articles: rows, loading: false, error: null });
        }
      } catch (err) {
        console.error('[useArticles] error:', err);
        if (!cancelled) {
          setState({
            articles: [],
            loading: false,
            error: 'Impossible de charger les articles',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category]);

  return state;
}

interface ArticleState {
  article: WithId<Article> | null;
  loading: boolean;
  error: string | null;
}

/**
 * "Articles similaires" — same-category siblings of the given
 * article, excluding the article itself. Mirrors the web blog
 * detail page (apps/web/app/blog/[slug]/page.tsx) so the two
 * surfaces show consistent suggestions.
 *
 * Returns up to `max` rows (default 3). Empty list while the
 * source article is still loading or null, or on error.
 */
export function useRelatedArticles(
  article: WithId<Article> | null | undefined,
  max: number = 3,
): { related: WithId<Article>[]; loading: boolean } {
  const [related, setRelated] = useState<WithId<Article>[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const articleId = article?.id;
  const articleCategory = article?.category;

  useEffect(() => {
    if (!articleId || !articleCategory) {
      setRelated([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await articleRepository.getRelated(
          articleCategory,
          articleId,
          max,
        );
        if (!cancelled) setRelated(rows);
      } catch (err) {
        console.error('[useRelatedArticles] error:', err);
        if (!cancelled) setRelated([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, articleCategory, max]);

  return { related, loading };
}

export function useArticle(slug: string | undefined): ArticleState {
  const [state, setState] = useState<ArticleState>({
    article: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!slug) {
      setState({ article: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ article: null, loading: true, error: null });

    (async () => {
      try {
        const row = await articleRepository.getPublishedBySlug(slug);
        if (!cancelled) {
          setState({ article: row, loading: false, error: null });
        }
      } catch (err) {
        console.error('[useArticle] error:', err);
        if (!cancelled) {
          setState({
            article: null,
            loading: false,
            error: 'Impossible de charger cet article',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
