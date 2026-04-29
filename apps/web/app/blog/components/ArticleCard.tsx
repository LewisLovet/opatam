import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { ARTICLE_CATEGORY_LABELS, type ArticleCategory } from '@booking-app/shared';
import { youtubeThumbnailUrl } from '@/lib/youtube';

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
 * Pick the best image to show on a list card. Priority:
 *  1. Explicit cover image set by the author
 *  2. Custom video poster (videoCoverURL) if a video is set
 *  3. YouTube auto-thumbnail derived from the video URL — `hqdefault` is
 *     guaranteed to exist for any video and 480×360 is enough for cards
 *  4. Fall through to the typographic fallback (caller renders it)
 */
function resolveCardImage(article: ArticleCardData): string | null {
  if (article.coverImageURL) return article.coverImageURL;
  if (article.videoCoverURL) return article.videoCoverURL;
  return youtubeThumbnailUrl(article.videoUrl, 'hq');
}

interface Props {
  article: ArticleCardData;
  /** Visual emphasis variant — used for the first card on /blog. */
  featured?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ArticleCard({ article, featured = false }: Props) {
  const imageURL = resolveCardImage(article);
  const hasVideo = !!article.videoUrl;

  return (
    <Link
      href={`/blog/${article.slug}`}
      className={`group block rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800 transition-all ${
        featured ? 'sm:grid sm:grid-cols-2 sm:gap-0' : ''
      }`}
    >
      {/* Cover */}
      <div
        className={`relative bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20 ${
          featured ? 'aspect-[4/3] sm:aspect-auto sm:h-full' : 'aspect-[16/10]'
        }`}
      >
        {imageURL ? (
          <Image
            src={imageURL}
            alt=""
            fill
            sizes={featured ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 100vw, 33vw'}
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-primary-400 dark:text-primary-600 text-6xl font-bold opacity-50">
            {article.title.charAt(0).toUpperCase()}
          </div>
        )}

        {hasVideo && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold backdrop-blur-sm">
            <PlayCircle className="w-3 h-3" />
            Vidéo
          </span>
        )}
      </div>

      {/* Content */}
      <div className={`p-5 ${featured ? 'sm:p-7 flex flex-col justify-center' : ''}`}>
        <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-2">
          {ARTICLE_CATEGORY_LABELS[article.category]}
        </span>
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
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <span>
            {article.authorName} · {formatDate(article.publishedAt)}
          </span>
          <span className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium group-hover:translate-x-0.5 transition-transform">
            Lire <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
