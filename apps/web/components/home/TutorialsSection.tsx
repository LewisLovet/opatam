import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { ArticleCard, type ArticleCardData } from '@/app/blog/components/ArticleCard';
import { TutorialsCarousel } from './TutorialsCarousel';

interface TutorialsSectionProps {
  tutorials: ArticleCardData[];
}

/**
 * Homepage block showcasing video tutorials.
 *
 * Renders nothing when the list is empty — we never want a sad placeholder
 * on the landing page when no tutorial has been published yet.
 */
export function TutorialsSection({ tutorials }: TutorialsSectionProps) {
  const t = useTranslations('home.tutorials');
  if (tutorials.length === 0) return null;

  return (
    <section
      id="tutoriels"
      className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold mb-4">
            <GraduationCap className="w-3.5 h-3.5" />
            {t('badge')}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        {/* Mobile: auto-advancing carousel (one card at a time,
            scroll-snap, dots indicator). Hidden from sm+ via a
            `sm:hidden` on its wrapper. */}
        <TutorialsCarousel tutorials={tutorials} />

        {/* Tablet + desktop: original 2/3-col grid. Hidden under
            sm so it never stacks vertically on phones (the
            carousel above takes over there). */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tutorials.map((t) => (
            <ArticleCard key={t.slug} article={t} />
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/blog/categorie/tutoriels"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-semibold hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all"
          >
            {t('seeAll')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
