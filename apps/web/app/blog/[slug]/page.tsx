/**
 * Public article reader.
 *
 * Wraps the shared <ArticleBody> with the public Header/Footer
 * and the SEO/JSON-LD payload. The actual rendering of the
 * article body, sidebar and related grid lives in the shared
 * component so the in-dashboard pro reader (/pro/tutoriels/[slug])
 * stays in sync without duplication.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { articleRepository } from '@booking-app/firebase';
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from '@booking-app/shared';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { youtubeThumbnailUrl } from '@/lib/youtube';
import { ArticleBody } from '../components/ArticleBody';

const BASE_URL = 'https://opatam.com';

// 1h ISR — articles change rarely, but a fresh edit shows up within an hour.
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleRepository.getPublishedBySlug(slug).catch(() => null);

  if (!article) {
    return { title: 'Article introuvable' };
  }

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  // Same fallback chain as the cards: explicit OG → cover → video poster → YouTube auto-thumb.
  // Without this, articles with only a video and no cover image lose their preview on
  // Facebook / LinkedIn / Slack / Twitter.
  const ogImage =
    article.ogImageURL ||
    article.coverImageURL ||
    article.videoCoverURL ||
    youtubeThumbnailUrl(article.videoUrl, 'maxres');
  const url = `${BASE_URL}/blog/${article.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: 'Opatam',
      locale: 'fr_FR',
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.authorName],
      images: ogImage ? [ogImage] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await articleRepository.getPublishedBySlug(slug).catch((err) => {
    console.error('[blog] getPublishedBySlug failed:', err);
    return null;
  });
  if (!article) notFound();

  const related = await articleRepository
    .getRelated(article.category, article.id, 3)
    .catch(() => []);

  const url = `${BASE_URL}/blog/${article.slug}`;
  // Same fallback chain as generateMetadata above — keeps JSON-LD `image`
  // and the OG preview consistent.
  const ogImage =
    article.ogImageURL ||
    article.coverImageURL ||
    article.videoCoverURL ||
    youtubeThumbnailUrl(article.videoUrl, 'maxres');

  // JSON-LD — full Article schema for Google E-E-A-T signals
  const articleJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    inLanguage: 'fr-FR',
    url,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: article.authorName,
      ...(article.authorPhotoURL ? { image: article.authorPhotoURL } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Opatam',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/icon.png`,
      },
    },
    ...(ogImage ? { image: ogImage } : {}),
    articleSection: ARTICLE_CATEGORY_LABELS[article.category as ArticleCategory],
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  // VideoObject schema — added to the @graph if the article embeds a video.
  const videoJsonLd = article.videoUrl
    ? {
        '@type': 'VideoObject',
        name: article.title,
        description: article.excerpt,
        thumbnailUrl: article.videoCoverURL || ogImage || `${BASE_URL}/icon.png`,
        uploadDate: article.publishedAt?.toISOString(),
        contentUrl: article.videoUrl,
        embedUrl: article.videoUrl,
      }
    : null;

  const jsonLd = videoJsonLd
    ? { '@context': 'https://schema.org', '@graph': [articleJsonLd, videoJsonLd] }
    : articleJsonLd;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header />

      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <ArticleBody article={article} related={related} context="public" />
      </main>

      <Footer />
    </>
  );
}
