import type { Metadata } from 'next';
import Link from 'next/link';
import { articleRepository } from '@booking-app/firebase';
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from '@booking-app/shared';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArticleCard, type ArticleCardData } from './components/ArticleCard';

// Re-fetch the index every 30 min — fresh enough, easy on Firestore.
export const revalidate = 1800;

const BASE_URL = 'https://opatam.com';

export const metadata: Metadata = {
  title: 'Blog Opatam — Conseils, témoignages et tutoriels',
  description:
    'Conseils pour développer votre activité de prestataire de services, témoignages de pros qui utilisent Opatam et tutoriels pour exploiter au maximum la plateforme.',
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: 'Blog Opatam',
    description:
      'Conseils, témoignages et tutoriels pour les pros de la beauté, du bien-être et des services.',
    url: `${BASE_URL}/blog`,
    type: 'website',
  },
};

export default async function BlogIndexPage() {
  // Tolerate Firestore being unavailable / rules not yet deployed —
  // the blog should never 500 on the public landing.
  const articles = await articleRepository.getPublished(50).catch((err) => {
    console.error('[blog] getPublished failed:', err);
    return [];
  });

  // Map to the lightweight shape the cards expect
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

  // First article = featured display, rest = grid
  const [hero, ...rest] = cards;

  // JSON-LD: Blog + ItemList for the index — helps Google build the
  // "Top stories" / blog carousel for our domain.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${BASE_URL}/blog#blog`,
        name: 'Blog Opatam',
        description: metadata.description,
        url: `${BASE_URL}/blog`,
      },
      ...(cards.length > 0
        ? [
            {
              '@type': 'ItemList',
              itemListElement: cards.slice(0, 10).map((c, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${BASE_URL}/blog/${c.slug}`,
                name: c.title,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header />

      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
        {/* Hero */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-3">
              Blog Opatam
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white max-w-3xl leading-tight">
              Conseils, témoignages et tutoriels pour développer votre activité.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
              Tout ce qu&apos;il faut savoir pour gérer ses rendez-vous, fidéliser ses clients
              et exploiter Opatam au maximum.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Category nav */}
          <nav className="mb-10 flex flex-wrap gap-2">
            <Link
              href="/blog"
              className="px-4 py-2 rounded-full bg-primary-600 text-white text-sm font-semibold"
              aria-current="page"
            >
              Tous les articles
            </Link>
            {(Object.keys(ARTICLE_CATEGORY_LABELS) as ArticleCategory[]).map((c) => (
              <Link
                key={c}
                href={`/blog/categorie/${c}`}
                className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                {ARTICLE_CATEGORY_LABELS[c]}
              </Link>
            ))}
          </nav>

          {/* Empty state */}
          {cards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Bientôt sur le blog
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Nous préparons nos premiers articles. Reviens dans quelques jours.
              </p>
            </div>
          )}

          {/* Hero article */}
          {hero && (
            <div className="mb-12">
              <ArticleCard article={hero} featured />
            </div>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
