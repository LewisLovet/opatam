import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, PlayCircle, Megaphone } from 'lucide-react';
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleNew,
  type ArticleCategory,
} from '@booking-app/shared';
import { YouTubeThumbnail } from './YouTubeThumbnail';

export interface ArticleCardData {
  slug: string;
  title: string;
  excerpt: string;
  coverImageURL: string | null;
  category: ArticleCategory;
  /** Full YouTube URL when present — used to derive a fallback thumbnail */
  videoUrl: string | null;
  /** Custom video poster URL, takes precedence over the YouTube auto-thumbnail */
  videoCoverURL: string | null;
  publishedAt: string | null; // ISO
  authorName: string;
}

/**
 * Pick the static-cover URL for the card, in priority order:
 *  1. Explicit cover image set by the author
 *  2. Custom video poster (videoCoverURL) if a video is set
 *
 * If neither is set and the article has a YouTube video, the caller
 * renders <YouTubeThumbnail> instead — that component handles the
 * maxres → hq fallback so cards stay crisp on large layouts.
 */
function resolveStaticCover(article: ArticleCardData): string | null {
  if (article.coverImageURL) return article.coverImageURL;
  if (article.videoCoverURL) return article.videoCoverURL;
  return null;
}

interface Props {
  article: ArticleCardData;
  /** Visual emphasis variant — used for the first card on /blog. */
  featured?: boolean;
  /**
   * Path prefix to navigate to. Defaults to `/blog` (public reader),
   * but the in-dashboard pro tutoriels list passes `/pro/tutoriels`
   * so a click stays inside the pro chrome.
   */
  hrefBase?: string;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ArticleCard({
  article,
  featured = false,
  hrefBase = '/blog',
}: Props) {
  const t = useTranslations('blog');
  const locale = useLocale();
  const staticCover = resolveStaticCover(article);
  const hasVideo = !!article.videoUrl;
  // Falls back to a YouTube auto-thumbnail (HD with hq fallback) when
  // the author hasn't set a custom cover but did link a video.
  const showYouTubeFallback = !staticCover && hasVideo;

  return (
    <Link
      href={`${hrefBase}/${article.slug}`}
      className={`group rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800 transition-all ${
        featured ? 'block sm:grid sm:grid-cols-2 sm:gap-0' : 'flex flex-col h-full'
      }`}
    >
      {/* Cover */}
      <div
        className={`relative bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 ${
          featured ? 'aspect-[4/3] sm:aspect-auto sm:h-full' : 'aspect-[16/10]'
        }`}
      >
        {staticCover ? (
          <Image
            src={staticCover}
            alt=""
            fill
            sizes={featured ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 100vw, 33vw'}
            className="object-cover"
          />
        ) : showYouTubeFallback ? (
          <YouTubeThumbnail
            videoUrl={article.videoUrl}
            sizes={featured ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 100vw, 33vw'}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-primary-400 dark:text-primary-600 text-6xl font-bold opacity-50">
            {article.title.charAt(0).toUpperCase()}
          </div>
        )}

        {hasVideo && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold backdrop-blur-sm">
            <PlayCircle className="w-3 h-3" />
            {t('video')}
          </span>
        )}
      </div>

      {/* Content */}
      <div className={`p-5 ${featured ? 'sm:p-7 flex flex-col justify-center' : 'flex-1 flex flex-col'}`}>
        {/* Category pill + optional "Nouveau" pill on the same row.
            Both share the same uppercase-caption visual treatment so
            they read as siblings rather than the freshness badge
            being mistaken for a separate category. The recency check
            is purely time-based (14 days, see shared/utils/articles)
            so old posts age out automatically without per-user state. */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {ARTICLE_CATEGORY_LABELS[article.category]}
          </span>
          {isArticleNew(article.publishedAt) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wide">
              <Megaphone className="w-3 h-3" />
              {t('new')}
            </span>
          )}
        </div>
        <h3
          className={`font-bold text-gray-900 dark:text-white leading-tight group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors ${
            featured ? 'text-2xl sm:text-3xl' : 'text-lg'
          }`}
        >
          {article.title}
        </h3>
        <p
          className={`text-gray-600 dark:text-gray-400 mt-2 ${
            featured ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'
          }`}
        >
          {article.excerpt}
        </p>
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <span>
            {article.authorName} · {formatDate(article.publishedAt, locale)}
          </span>
          <span className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium group-hover:translate-x-0.5 transition-transform">
            {t('read')} <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
