'use client';

/**
 * ArticleSidebar — right rail on /blog/[slug] for desktop layouts.
 *
 * Three blocks:
 *  1. Table of contents — auto-built from the article markdown
 *     headings (server-side, passed in via props). Active heading
 *     is highlighted as the user scrolls; intersection-observer
 *     based, no scroll listeners.
 *  2. Articles similaires — compact cards (square thumbnail + title)
 *     so up to 3 fit comfortably in the rail without dominating.
 *  3. CTA — small upsell pointing to /register. The article is
 *     usually a tutorial, so the visitor is pre-qualified.
 *
 * Sticky on lg+ via `lg:sticky lg:top-24` — the rail follows the
 * scroll once the article body extends past the viewport. On
 * mobile the whole component is hidden (the related grid below
 * the article handles the same job in the linear flow).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, List, PlayCircle } from 'lucide-react';
import { ARTICLE_CATEGORY_LABELS } from '@booking-app/shared';
import { APP_CONFIG } from '@booking-app/shared/constants';
import type { ArticleCardData } from './ArticleCard';
import { YouTubeThumbnail } from './YouTubeThumbnail';
import type { Heading } from '../lib/article-utils';

interface Props {
  headings: Heading[];
  related: ArticleCardData[];
}

export function ArticleSidebar({ headings, related }: Props) {
  const [activeId, setActiveId] = useState<string>('');
  // Track the last "intentional" hash so smooth-scroll clicks land
  // on the heading at top-of-viewport instead of the heading the
  // observer happens to flag mid-animation.
  const userClickedRef = useRef(false);

  // Highlight the heading currently in the upper third of the
  // viewport. We anchor the observer's "trigger zone" between
  // 100px from the top (under the sticky header) and 70% down
  // the page so once a heading enters that band it's marked active.
  useEffect(() => {
    if (headings.length === 0) return;
    const els = headings
      .map((h) => document.getElementById(h.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (userClickedRef.current) return;
        // Pick the topmost intersecting heading so the active
        // marker doesn't jitter when several are visible at once.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-100px 0px -70% 0px', threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  // Click handler for TOC items — smooth scroll + lock the active
  // marker to the clicked heading for 700ms so the observer
  // doesn't fight the scroll animation.
  const onTocClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    const target = document.getElementById(slug);
    if (!target) return;
    e.preventDefault();
    setActiveId(slug);
    userClickedRef.current = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Update the URL hash without a hard jump.
    history.replaceState(null, '', `#${slug}`);
    setTimeout(() => {
      userClickedRef.current = false;
    }, 700);
  };

  return (
    <aside className="hidden lg:block lg:sticky lg:top-24 self-start space-y-8">
      {/* ── Table of contents ───────────────────────────────────── */}
      {headings.length > 1 && (
        <nav aria-label="Sommaire" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            <List className="w-4 h-4" />
            Sommaire
          </h2>
          <ul className="space-y-1.5 text-sm">
            {headings.map((h) => {
              const isActive = activeId === h.slug;
              return (
                <li
                  key={h.slug}
                  // ## is the typical section level in our articles
                  // so it stays at column 0; ### is a sub-section
                  // and gets indented so structure reads at a glance.
                  className={h.level === 3 ? 'ml-4' : ''}
                >
                  <a
                    href={`#${h.slug}`}
                    onClick={(e) => onTocClick(e, h.slug)}
                    className={`block py-1 leading-snug transition-colors border-l-2 pl-3 -ml-px ${
                      isActive
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-medium'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {h.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* ── Articles similaires ─────────────────────────────────── */}
      {related.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
            Articles similaires
          </h2>
          <ul className="space-y-4">
            {related.map((a) => (
              <li key={a.slug}>
                <RelatedItem article={a} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── CTA card ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white p-6 shadow-lg shadow-primary-600/20">
        <h2 className="text-lg font-bold leading-snug">
          Prêt à recevoir vos premières réservations ?
        </h2>
        <p className="mt-2 text-sm text-white/85">
          Créez votre page {APP_CONFIG.name} en 5 minutes.
          {' '}
          {APP_CONFIG.trialDays} jours gratuits, sans carte bancaire.
        </p>
        <Link
          href="/register"
          className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white text-primary-700 hover:bg-gray-50 hover:text-primary-800 rounded-lg text-sm font-semibold transition-colors w-full"
        >
          Créer ma page gratuitement
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </aside>
  );
}

/**
 * Compact sidebar version of an article card — square thumbnail
 * on the left + category + title on the right. Same hover
 * affordance as the full ArticleCard so it reads as a peer.
 */
function RelatedItem({ article }: { article: ArticleCardData }) {
  // Same fallback chain as the full card: explicit cover →
  // video poster → YouTube auto-thumb → letter placeholder.
  const staticCover = article.coverImageURL || article.videoCoverURL;
  const showYouTube = !staticCover && !!article.videoUrl;

  return (
    <Link href={`/blog/${article.slug}`} className="group flex gap-3 items-start">
      <div className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/20">
        {staticCover ? (
          <Image
            src={staticCover}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : showYouTube ? (
          <YouTubeThumbnail videoUrl={article.videoUrl} sizes="80px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-primary-400 dark:text-primary-600 text-2xl font-bold opacity-50">
            {article.title.charAt(0).toUpperCase()}
          </div>
        )}
        {!!article.videoUrl && (
          <span className="absolute bottom-1 right-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/70 text-white">
            <PlayCircle className="w-3 h-3" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
          {ARTICLE_CATEGORY_LABELS[article.category]}
        </span>
        <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}
