import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { articleRepository } from '@booking-app/firebase';
import LandingPage from './HomePage';
import type { ArticleCardData } from './blog/components/ArticleCard';

// Refresh the homepage tutorial block every 30 min — new tutorials are
// rare and ISR keeps Firestore reads tiny.
export const revalidate = 1800;

const BASE_URL = 'https://opatam.com';
// hreflang pair — declared on BOTH versions so Google links them and serves
// the right language. x-default = French (the historical, primary version).
const LANGUAGE_ALTERNATES = {
  fr: BASE_URL,
  en: `${BASE_URL}/en`,
  'x-default': BASE_URL,
};

// Serves both / (fr) and /en (re-export, locale set by middleware.ts).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations('seo.home');
  const canonical = locale === 'en' ? `${BASE_URL}/en` : BASE_URL;

  return {
    // absolute: the title already carries the brand — and the layout's
    // `%s | OPATAM` template applies to /en (child segment) but not to /,
    // so a plain string would render differently on the two URLs.
    title: { absolute: t('title') },
    description: t('description'),
    // Keywords meta is FR-only legacy (ignored by Google, kept for parity
    // with the historical page).
    ...(locale === 'fr' && {
      keywords: [
        'réservation en ligne',
        'prise de rendez-vous',
        'agenda professionnel',
        'logiciel de réservation',
        'booking en ligne',
        'sans commission',
        'coiffeur',
        'esthéticienne',
        'massage',
        'coaching',
      ],
    }),
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      url: canonical,
      type: 'website',
      locale: locale === 'en' ? 'en_GB' : 'fr_FR',
      siteName: 'Opatam',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
    alternates: {
      canonical,
      languages: LANGUAGE_ALTERNATES,
    },
  };
}

// Organization + SoftwareApplication + SearchAction structured data.
// Built per locale: org description + FAQ follow the page language (the FAQ
// text comes straight from the home dictionary so it never drifts from the
// visible FAQ section).
function buildJsonLd(
  orgDescription: string,
  faqItems: { question: string; answer: string }[],
) {
  return {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Opatam',
      url: 'https://opatam.com',
      logo: 'https://opatam.com/logo.png',
      description: orgDescription,
      sameAs: [
        'https://www.instagram.com/opatam_app',
        'https://www.tiktok.com/@opatam_app',
      ],
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Opatam',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'iOS, Android, Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        description: 'Essai gratuit',
      },
    },
    {
      '@type': 'WebSite',
      url: 'https://opatam.com',
      name: 'Opatam',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://opatam.com/recherche/{search_term}',
        },
        'query-input': 'required name=search_term',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ],
  };
}

export default async function Page() {
  const tSeo = await getTranslations('seo.home');
  const tFaq = await getTranslations('home.faq');
  const jsonLd = buildJsonLd(
    tSeo('orgDescription'),
    tFaq.raw('items') as { question: string; answer: string }[],
  );
  // Tutorials block on the homepage — pulled from the blog with category
  // 'tutoriels'. Tolerant: an empty list (no tutorial yet, or Firestore
  // unavailable) just hides the section, never breaks the landing.
  const tutorialDocs = await articleRepository
    .getPublishedByCategory('tutoriels', 3)
    .catch((err) => {
      console.error('[home] getPublishedByCategory(tutoriels) failed:', err);
      return [];
    });

  const tutorials: ArticleCardData[] = tutorialDocs.map((a) => ({
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
      <LandingPage tutorials={tutorials} />
    </>
  );
}
