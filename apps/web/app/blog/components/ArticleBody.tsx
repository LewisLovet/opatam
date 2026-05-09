/**
 * ArticleBody
 *
 * Renders the article reading experience: back link, header
 * (category + "Nouveau" pill + title + excerpt + author/date/
 * reading time), cover or video, the markdown body itself, and
 * the sidebar (TOC + related) on lg+. The mobile-related grid is
 * also rendered in line so it shows up under the article on
 * narrow viewports where the sidebar collapses.
 *
 * Used by two surfaces:
 *   - /blog/[slug]            → public reading, wrapped in
 *                               Header/Footer + JSON-LD by the page.
 *   - /pro/tutoriels/[slug]   → in-dashboard reading, wrapped in
 *                               the pro layout's sidebar.
 *
 * Both contexts call `getRelated` themselves and pass the result
 * down — keeping the data fetch in the page is cheaper than
 * making this component async with overlapping fetches when both
 * surfaces want different category-link semantics.
 *
 * `context` controls the small differences between the two:
 *   - back link destination + label
 *   - URL the category pill points to
 *   - URL the related-article cards link to (cards are unchanged
 *     in shape — they always navigate to /blog/<slug> for the
 *     read since both contexts ultimately rely on this same
 *     component to render the next article)
 */

import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, Clock, Sparkles } from 'lucide-react';
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleNew,
  type Article,
  type ArticleCategory,
} from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { LiteYouTube } from './LiteYouTube';
import { ArticleCard, type ArticleCardData } from './ArticleCard';
import { ArticleSidebar } from './ArticleSidebar';
import {
  extractHeadings,
  reactChildrenToText,
  readingTimeMinutes,
  slugify,
} from '../lib/article-utils';

export type ArticleBodyContext = 'public' | 'pro';

interface Props {
  article: WithId<Article>;
  related: WithId<Article>[];
  context: ArticleBodyContext;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Per-context navigation labels + URLs. Centralised so the JSX
 *  below stays focused on layout rather than branching on context. */
function navFor(context: ArticleBodyContext) {
  if (context === 'pro') {
    return {
      backHref: '/pro/tutoriels',
      backLabel: 'Tutoriels & guides',
      // In pro context the category pill filters the in-dashboard
      // list, so the user stays inside the chrome.
      categoryHref: (cat: ArticleCategory) =>
        cat === 'tutoriels'
          ? '/pro/tutoriels'
          : `/pro/tutoriels?categorie=${cat}`,
      // Related-article cards link to the pro reader so the user
      // doesn't lose the dashboard chrome by tapping a sibling.
      relatedHrefBase: '/pro/tutoriels',
    };
  }
  return {
    backHref: '/blog',
    backLabel: 'Tous les articles',
    categoryHref: (cat: ArticleCategory) => `/blog/categorie/${cat}`,
    relatedHrefBase: '/blog',
  };
}

export function ArticleBody({ article, related, context }: Props) {
  const nav = navFor(context);

  const relatedCards: ArticleCardData[] = related.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    coverImageURL: a.coverImageURL,
    category: a.category,
    videoUrl: a.videoUrl,
    videoCoverURL: a.videoCoverURL,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    authorName: a.authorName,
  }));

  // Sidebar TOC + reading-time estimate. Both are derived from the
  // same markdown source the body renders, so the slugs we attach
  // to headings below match what the TOC anchors to.
  const headings = extractHeadings(article.body);
  const readingMinutes = readingTimeMinutes(article.body);

  return (
    <div className="pb-16">
      {/* Back link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link
          href={nav.backHref}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {nav.backLabel}
        </Link>
      </div>

      {/* Two-column layout on lg+: article (8 cols) + sticky
          sidebar (4 cols). On mobile/tablet, sidebar disappears
          and the related grid below the article handles its
          relationship-discovery role in the linear flow. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          <article className="lg:col-span-8">
            {/* Header */}
            <header className="mb-8">
              {/* Category link + optional "Nouveau" pill — same
                  visual treatment used on /blog cards so a fresh
                  article is recognisable on the index *and* on
                  its detail page header. */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Link
                  href={nav.categoryHref(article.category as ArticleCategory)}
                  className="inline-block text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {ARTICLE_CATEGORY_LABELS[article.category as ArticleCategory]}
                </Link>
                {isArticleNew(article.publishedAt) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold uppercase tracking-wide">
                    <Sparkles className="w-3 h-3" />
                    Nouveau
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
                {article.title}
              </h1>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                {article.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500 dark:text-gray-500">
                {article.authorPhotoURL ? (
                  <Image
                    src={article.authorPhotoURL}
                    alt={article.authorName}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 text-sm font-semibold">
                    {article.authorName.charAt(0)}
                  </div>
                )}
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {article.authorName}
                  </span>
                  {article.publishedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <time dateTime={article.publishedAt.toISOString()}>
                        {formatDate(article.publishedAt)}
                      </time>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {readingMinutes} min de lecture
                  </span>
                </span>
              </div>
            </header>

            {/* Cover image */}
            {article.coverImageURL && !article.videoUrl && (
              <div className="mb-10 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-[16/9] relative">
                <Image
                  src={article.coverImageURL}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 768px"
                  className="object-cover"
                />
              </div>
            )}

            {/* Video (replaces cover when present) */}
            {article.videoUrl && (
              <div className="mb-10">
                <LiteYouTube
                  url={article.videoUrl}
                  posterURL={article.videoCoverURL || article.coverImageURL}
                  title={article.title}
                />
              </div>
            )}

            {/* Markdown body. The H1/H2/H3 components attach a
                slug-based `id` so the sidebar TOC can deep-link
                and the IntersectionObserver can flag the active
                section. `scroll-mt-24` keeps the heading from
                hiding behind the sticky header after a jump. */}
            <div className="prose-article">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => {
                    const id = slugify(reactChildrenToText(children));
                    return (
                      <h2
                        id={id}
                        className="scroll-mt-24 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4"
                      >
                        {children}
                      </h2>
                    );
                  },
                  h2: ({ children }) => {
                    const id = slugify(reactChildrenToText(children));
                    return (
                      <h2
                        id={id}
                        className="scroll-mt-24 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4"
                      >
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => {
                    const id = slugify(reactChildrenToText(children));
                    return (
                      <h3
                        id={id}
                        className="scroll-mt-24 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-3"
                      >
                        {children}
                      </h3>
                    );
                  },
                  p: ({ children }) => (
                    <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-5">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-6 mb-5 space-y-2 text-gray-700 dark:text-gray-300">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-6 mb-5 space-y-2 text-gray-700 dark:text-gray-300">
                      {children}
                    </ol>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-primary-600 dark:text-primary-400 underline hover:text-primary-700 dark:hover:text-primary-300"
                      target={href?.startsWith('http') ? '_blank' : undefined}
                      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-600 dark:text-gray-400 my-6">
                      {children}
                    </blockquote>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-gray-900 dark:text-white">
                      {children}
                    </strong>
                  ),
                  code: ({ children }) => (
                    <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[0.9em] font-mono text-primary-700 dark:text-primary-300">
                      {children}
                    </code>
                  ),
                  img: ({ src, alt }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src as string}
                      alt={alt || ''}
                      className="rounded-xl my-6 w-full"
                      loading="lazy"
                    />
                  ),
                }}
              >
                {article.body}
              </ReactMarkdown>
            </div>
          </article>

          {/* Right rail — TOC + related + CTA. Hidden under lg;
              on mobile the bottom-related section below the
              article handles relationship discovery. */}
          <div className="hidden lg:block lg:col-span-4">
            <ArticleSidebar
              headings={headings}
              related={relatedCards}
              hrefBase={nav.relatedHrefBase}
            />
          </div>
        </div>
      </div>

      {/* Related articles — visible only under lg, since the
          sidebar already covers this need on desktop. Keeps the
          mobile flow informative without duplication. */}
      {relatedCards.length > 0 && (
        <section className="lg:hidden max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-12 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Articles similaires
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {relatedCards.map((a) => (
              <ArticleCard
                key={a.slug}
                article={a}
                hrefBase={nav.relatedHrefBase}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
