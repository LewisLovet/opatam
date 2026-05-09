/**
 * Pro — Tutoriel reader
 *
 * Reuses the shared <ArticleBody> with `context="pro"` so the
 * back link, the category-pill destination and the related-card
 * targets all stay inside the dashboard chrome instead of leaking
 * the user out to the public /blog.
 *
 * No Header/Footer here: the parent /pro layout already provides
 * the sidebar + dashboard chrome. No JSON-LD either — this is an
 * authenticated surface, search engines never see it.
 *
 * The page itself is intentionally trivial: fetch + delegate. All
 * the rendering work is in ArticleBody so a tweak there propagates
 * to /blog and /pro/tutoriels at once.
 */

import { notFound } from 'next/navigation';
import { articleRepository } from '@booking-app/firebase';
import { ArticleBody } from '../../../blog/components/ArticleBody';

// 1h ISR — same cadence as the public blog reader; we don't need
// fresher because authors edit via the admin and re-publish.
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const metadata = {
  // The dashboard layout already shows the brand chrome, so we
  // keep the title focused on the content (the article itself
  // overrides this via document.title once we're client-side, but
  // the static fallback is good enough for the in-app context).
  title: 'Tutoriels & guides — Opatam Pro',
};

export default async function ProTutorielPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await articleRepository.getPublishedBySlug(slug).catch((err) => {
    console.error('[pro/tutoriels] getPublishedBySlug failed:', err);
    return null;
  });
  if (!article) notFound();

  // Same `getRelated` fetch the public reader uses — same-category
  // siblings, current article excluded, max 3.
  const related = await articleRepository
    .getRelated(article.category, article.id, 3)
    .catch(() => []);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-6 lg:-my-8">
      {/* Pull the body out of the pro layout's `p-4 sm:p-6 lg:p-8`
          padding so the article's own max-w container drives the
          horizontal rhythm — otherwise we'd get an awkward double
          gutter on wide screens. The negative margins exactly
          cancel the layout padding declared in apps/web/app/pro/layout.tsx. */}
      <ArticleBody article={article} related={related} context="pro" />
    </div>
  );
}
