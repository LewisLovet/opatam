import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { articleRepository } from '@booking-app/firebase';
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from '@booking-app/shared';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArticleCard, type ArticleCardData } from '../../components/ArticleCard';

const BASE_URL = 'https://opatam.com';

export const revalidate = 1800;

interface PageProps {
  params: Promise<{ cat: string }>;
}

function isValidCategory(cat: string): cat is ArticleCategory {
  return (ARTICLE_CATEGORIES as string[]).includes(cat);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cat } = await params;
  if (!isValidCategory(cat)) return { title: 'Catégorie introuvable' };
  const label = ARTICLE_CATEGORY_LABELS[cat];
  return {
    title: `${label} — Blog Opatam`,
    description: `Tous les articles dans la catégorie ${label}.`,
    alternates: { canonical: `${BASE_URL}/blog/categorie/${cat}` },
    openGraph: {
      title: `${label} — Blog Opatam`,
      url: `${BASE_URL}/blog/categorie/${cat}`,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { cat } = await params;
  if (!isValidCategory(cat)) notFound();

  const articles = await articleRepository
    .getPublishedByCategory(cat, 50)
    .catch((err) => {
      console.error('[blog] getPublishedByCategory failed:', err);
      return [];
    });
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

  const label = ARTICLE_CATEGORY_LABELS[cat];

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              Tous les articles
            </Link>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
              Catégorie
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              {label}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {articles.length} article{articles.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Pas encore d&apos;article dans cette catégorie. Reviens bientôt !
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((a) => (
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

// Pre-render the 3 known categories at build time
export function generateStaticParams() {
  return ARTICLE_CATEGORIES.map((cat) => ({ cat }));
}
