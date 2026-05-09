/**
 * useNewArticles
 *
 * Drives two pieces of UX around fresh tutorial / article content:
 *
 *   1. The "Nouveau" pill on the Plus → Tutoriels & guides menu
 *      entry, which we want to re-fire whenever a tutorial newer
 *      than the user's last visit is published — not just on first
 *      install. The plain `useNewFeatures` hook tracks one fixed
 *      key per shipped feature, so it can't say "something newer
 *      than last time exists"; this hook can.
 *
 *   2. The per-card "Nouveau" badge in the help list, applied to
 *      any article published within the last NEW_DAYS days. Used
 *      to nudge providers towards fresh content even when they
 *      haven't visited the section yet — purely time-based, no
 *      user state required.
 *
 * State shape:
 *   AsyncStorage["@opatam/help-last-visit-v1"] = number (ms epoch)
 *
 * Why a persistent timestamp rather than a Set of seen slugs:
 *   - Cheaper (one write per visit, not per article tap)
 *   - Survives slug renames / re-publishing
 *   - Mirrors how a "since last visit" badge typically works
 *     elsewhere in the product (notifications, etc.)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useArticles } from './useArticles';
import type { ArticleCategory } from '@booking-app/shared';

const STORAGE_KEY = '@opatam/help-last-visit-v1';

/**
 * How long after publication an article keeps the "Nouveau" pill
 * on its card. Two weeks gives us a sensible window: long enough
 * that providers who only open the app weekly still see new posts
 * highlighted, short enough that the pill doesn't lose meaning.
 */
export const NEW_ARTICLE_DAYS = 14;

/** Coerce Firestore-y date values into a plain epoch ms number. */
function toEpoch(d: Date | { toDate: () => Date } | string | null | undefined): number {
  if (!d) return 0;
  if (typeof d === 'string') {
    const t = new Date(d).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (d instanceof Date) return d.getTime();
  if (typeof (d as { toDate?: () => Date }).toDate === 'function') {
    return (d as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

/** True when `publishedAt` is within the recency window. */
export function isArticleNew(
  publishedAt: Date | { toDate: () => Date } | string | null | undefined,
  days: number = NEW_ARTICLE_DAYS,
): boolean {
  const ms = toEpoch(publishedAt);
  if (!ms) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return ms >= cutoff;
}

interface UseNewArticlesResult {
  /** True if at least one article was published since `lastVisitAt`. */
  hasNew: boolean;
  /**
   * Number of articles newer than `lastVisitAt`. Useful if we ever
   * want to show "3 nouveaux tutos" on the menu entry rather than
   * a plain "Nouveau" pill.
   */
  newCount: number;
  /** Whether the AsyncStorage hydration has finished. */
  ready: boolean;
  /**
   * Persist the current time as the user's last visit. Call from
   * the help screen on mount — that visually clears the menu badge.
   */
  markVisited: () => Promise<void>;
}

/**
 * Tracks "last help-section visit" in AsyncStorage and compares
 * it against the latest tutorial / advice article publication
 * dates so the menu can flag fresh content.
 *
 * Pulls the article list from the same `useArticles` hook the
 * help screens use — we deliberately reuse the existing fetch so
 * we don't duplicate Firestore reads. The tradeoff: any consumer
 * of this hook triggers an articles fetch (cheap, ~50 docs).
 */
export function useNewArticles(
  category?: ArticleCategory,
): UseNewArticlesResult {
  const { articles } = useArticles(category);
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  // Hydrate once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        const parsed = raw ? Number.parseInt(raw, 10) : 0;
        setLastVisit(Number.isFinite(parsed) ? parsed : 0);
      } catch (err) {
        console.warn('[useNewArticles] hydrate failed:', err);
        if (!cancelled) setLastVisit(0);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markVisited = useCallback(async () => {
    const now = Date.now();
    setLastVisit(now);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(now));
    } catch (err) {
      console.warn('[useNewArticles] persist failed:', err);
    }
  }, []);

  const { hasNew, newCount } = useMemo(() => {
    // Don't claim "new" until hydration has happened — otherwise we
    // briefly flash the badge to every user on every mount.
    if (!ready || lastVisit == null) {
      return { hasNew: false, newCount: 0 };
    }
    const fresh = articles.filter((a) => {
      const ms = toEpoch(a.publishedAt);
      // Two guards:
      //  - publication strictly newer than the user's last visit
      //  - and within the recency window — avoid resurfacing an
      //    article that was actually published months ago but the
      //    user just installed (lastVisit = 0)
      return (
        ms > lastVisit &&
        ms >= Date.now() - NEW_ARTICLE_DAYS * 24 * 60 * 60 * 1000
      );
    });
    return { hasNew: fresh.length > 0, newCount: fresh.length };
  }, [articles, lastVisit, ready]);

  return { hasNew, newCount, ready, markVisited };
}
