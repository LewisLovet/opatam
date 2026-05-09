/**
 * Article freshness helpers — shared between the public web blog
 * (apps/web/app/blog/components/ArticleCard.tsx) and the in-app
 * tutoriels surface on mobile (apps/mobile/...).
 *
 * Pure logic only — no platform deps. The mobile-specific
 * "since-last-visit" tracking that wraps these (AsyncStorage,
 * useArticles fetch, etc.) lives in apps/mobile/hooks/useNewArticles.ts
 * and stays there because it depends on RN-only APIs.
 */

/**
 * Default recency window for the "Nouveau" pill on article cards.
 * Two weeks gives a sensible signal: long enough that pros / web
 * visitors who only land weekly still see new posts highlighted,
 * short enough that the pill doesn't lose meaning by lingering.
 */
export const NEW_ARTICLE_DAYS = 14;

/**
 * Coerce a Firestore-y or stringified date value into an epoch ms
 * number. Returns 0 for any unparseable input — callers should
 * treat 0 as "no date" (which never matches the recency check).
 */
export function toArticleEpoch(
  d: Date | { toDate: () => Date } | string | null | undefined,
): number {
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

/**
 * True when `publishedAt` is within the recency window. The default
 * window is `NEW_ARTICLE_DAYS` (14) but callers can override — the
 * "since last visit" mobile flow passes a smaller value when needed.
 */
export function isArticleNew(
  publishedAt: Date | { toDate: () => Date } | string | null | undefined,
  days: number = NEW_ARTICLE_DAYS,
): boolean {
  const ms = toArticleEpoch(publishedAt);
  if (!ms) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return ms >= cutoff;
}
