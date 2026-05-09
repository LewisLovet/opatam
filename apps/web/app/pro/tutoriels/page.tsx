/**
 * Pro — Tutoriels & guides
 *
 * In-app reading list of the same articles surfaced on the public
 * `/blog` and on the mobile pro space. Scoped to the two
 * provider-useful categories — `tutoriels` (how-to walkthroughs)
 * and `conseils` (business advice). `temoignages` are intentionally
 * excluded: they target prospects, not active pros, and the pro
 * dashboard isn't where we want to sell the platform back to people
 * who've already bought it.
 *
 * Card → /pro/tutoriels/<slug>. The shared <ArticleBody>
 * component renders both the public /blog and this in-dashboard
 * reader so they stay in sync; the difference is just the
 * surrounding chrome (Header/Footer on /blog, sidebar on /pro)
 * and the navigation destinations (back link, category pill).
 *
 * The default landing view is "tutoriels" because that's the most
 * directly actionable bucket. The chip strip lets the pro flip to
 * "Conseils" or "Tous". Selection is encoded in `?categorie=` so
 * the URL is shareable and the page stays a pure server component.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { articleRepository } from '@booking-app/firebase';
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from '@booking-app/shared';
import { ArticleCard, type ArticleCardData } from '../../blog/components/ArticleCard';

// Re-fetch every 30 min like the public blog — articles change
// rarely, no need to hammer Firestore on every dashboard load.
export const revalidate = 1800;

export const metadata: Metadata = {
  title: 'Tutoriels & guides — Opatam Pro',
};

/** Categories shown in the chip strip + accepted on `?categorie=`. */
type FilterValue = 'tutoriels' | 'conseils' | 'all';

const FILTER_CHIPS: { value: FilterValue; label: string }[] = [
  { value: 'tutoriels', label: ARTICLE_CATEGORY_LABELS.tutoriels },
  { value: 'conseils', label: ARTICLE_CATEGORY_LABELS.conseils },
  { value: 'all', label: 'Tous' },
];

interface PageProps {
  // Next 15 search params come in async — `await` before reading.
  searchParams: Promise<{ categorie?: string }>;
}

/** Coerce the raw query value into a known filter, defaulting to
 *  tutoriels (the most useful bucket for an in-product help surface).
 *  An unknown value silently falls back to the default rather than
 *  404'ing, since this is a dashboard surface and we'd rather show
 *  something useful than an error. */
function parseFilter(raw: string | undefined): FilterValue {
  if (raw === 'tutoriels' || raw === 'conseils' || raw === 'all') return raw;
  return 'tutoriels';
}

export default async function ProTutorielsPage({ searchParams }: PageProps) {
  const { categorie } = await searchParams;
  const filter = parseFilter(categorie);

  // Fetch — single query for `all`, narrowed query for the two
  // single-category views. We exclude testimonials manually in the
  // "all" branch since they're never relevant to pros.
  const articles = await (async () => {
    try {
      if (filter === 'all') {
        const rows = await articleRepository.getPublished(50);
        return rows.filter((a) => a.category !== 'temoignages');
      }
      return await articleRepository.getPublishedByCategory(filter, 50);
    } catch (err) {
      console.error('[pro/tutoriels] fetch failed:', err);
      return [];
    }
  })();

  // Same lightweight shape the public ArticleCard expects.
  const cards: ArticleCardData[] = articles.map((a) => ({
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

  // Full width inside the dashboard content area — the layout
  // already constrains horizontal space with its sidebar so we
  // don't need a max-w cap here. Without this, the grid sat
  // stranded in the middle on wide screens with empty gutters
  // either side. The 2xl breakpoint on the grid below adds a
  // 4th column so big monitors don't end up with cards stretched
  // to ~600px each.
  return (
    <div className="w-full">
      {/* Page header — short caption + value prop. No back button:
          the pro layout's sidebar is the navigation. */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
          Espace pro
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
          Tutoriels &amp; guides
        </h1>
        <p className="mt-2 text-base text-gray-600 dark:text-gray-400 max-w-2xl">
          Apprenez à tirer le meilleur d&apos;Opatam — pas à pas pour
          configurer la plateforme, conseils pour faire grandir votre
          activité.
        </p>
      </div>

      {/* Category chips — links so the URL drives state and the
          server component stays pure. `aria-current` tags the
          active chip for assistive tech. */}
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Filtrer par catégorie">
        {FILTER_CHIPS.map((c) => {
          const active = filter === c.value;
          // The "tutoriels" default deserves a clean URL — we drop
          // `?categorie=tutoriels` so navigating from the sidebar
          // and tapping the chip both land on the same canonical
          // path.
          const href = c.value === 'tutoriels' ? '/pro/tutoriels' : `/pro/tutoriels?categorie=${c.value}`;
          return (
            <Link
              key={c.value}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'px-4 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold'
                  : 'px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700 transition-colors'
              }
            >
              {c.label}
            </Link>
          );
        })}
      </nav>

      {/* Empty state — friendlier than a 404 since this is a
          dashboard surface where the user expects content. */}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Bientôt disponible
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Aucun article ne correspond à cette catégorie pour le
            moment. Revenez bientôt — nous publions régulièrement.
          </p>
        </div>
      ) : (
        // Grid of cards — no featured/hero treatment here; this is
        // a utilitarian help surface, the pro is looking for a
        // specific topic, not browsing leisurely.
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {cards.map((a) => (
            <ArticleCard
              key={a.slug}
              article={a}
              // Stay inside the pro chrome on click — opens the
              // /pro/tutoriels/[slug] reader which uses the same
              // shared <ArticleBody> the public /blog renders, just
              // wrapped in the dashboard sidebar.
              hrefBase="/pro/tutoriels"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Keep TS aware that `filter` is narrowed to ArticleCategory in the
// repository call branch — the type assertion below isn't needed at
// runtime but stops TS complaining about the union narrowing.
type _AssertCategorySubset = Exclude<FilterValue, 'all'> extends ArticleCategory
  ? true
  : never;
const _check: _AssertCategorySubset = true;
void _check;
