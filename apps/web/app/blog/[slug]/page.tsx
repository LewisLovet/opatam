import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft } from 'lucide-react';
import { articleRepository } from '@booking-app/firebase';
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from '@booking-app/shared';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { youtubeThumbnailUrl } from '@/lib/youtube';
import { LiteYouTube } from '../components/LiteYouTube';
import { ArticleCard, type ArticleCardData } from '../components/ArticleCard';

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

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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

  // Related → ArticleCard format
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Header />

      <main className="min-h-screen bg-white dark:bg-gray-900 pb-16">
        {/* Back link + category */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Tous les articles
          </Link>
        </div>

        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mt-6 mb-8">
            <Link
              href={`/blog/categorie/${article.category}`}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 hover:underline mb-3"
            >
              {ARTICLE_CATEGORY_LABELS[article.category as ArticleCategory]}
            </Link>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
              {article.title}
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              {article.excerpt}
            </p>
            <div className="mt-6 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-500">
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
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {article.authorName}
                </span>
                {article.publishedAt && (
                  <>
                    {' · '}
                    <time dateTime={article.publishedAt.toISOString()}>
                      {formatDate(article.publishedAt)}
                    </time>
                  </>
                )}
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
                sizes="(max-width: 768px) 100vw, 768px"
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

          {/* Markdown body */}
          <div className="prose-article">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4">
                    {children}
                  </h2>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-4">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-3">
                    {children}
                  </h3>
                ),
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

        {/* Related articles */}
        {relatedCards.length > 0 && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-12 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Articles similaires
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedCards.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
