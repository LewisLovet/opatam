import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { APP_CONFIG, CATEGORIES } from '@booking-app/shared/constants';
import { ogLocale } from '@/lib/ogLocale';
import LandingV1 from './v1/LandingV1';
import { chargerVideosAccueil } from './v1/loadVideos';

// Rafraîchi toutes les 5 min : la sélection de vidéos de prestataires se
// gère depuis l'admin et doit apparaître sans attendre une demi-heure.
// Les lectures Firestore restent minimes (deux documents).
export const revalidate = 300;

const BASE_URL = 'https://opatam.com';
// hreflang pair — declared on BOTH versions so Google links them and serves
// the right language. x-default = French (the historical, primary version).
const LANGUAGE_ALTERNATES = {
  fr: BASE_URL,
  en: `${BASE_URL}/en`,
  it: `${BASE_URL}/it`,
  pt: `${BASE_URL}/pt`,
  de: `${BASE_URL}/de`,
  'x-default': BASE_URL,
};

// Serves both / (fr) and /en (re-export, locale set by middleware.ts).
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations('seo.home');
  const canonical = locale === 'fr' ? BASE_URL : `${BASE_URL}/${locale}`;

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
      locale: ogLocale(locale),
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
  // La FAQ du JSON-LD est CELLE affichée : les questions de la nouvelle
  // page (landing.faq), dans la langue servie, avec la durée d'essai injectée
  // comme à l'écran.
  const tLanding = await getTranslations('landing');
  const questions = tLanding.raw('faq.items') as { question: string; answer: string }[];
  const jsonLd = buildJsonLd(
    tSeo('orgDescription'),
    questions.map((item, index) => ({
      question: item.question,
      answer: tLanding(`faq.items.${index}.answer`, { days: APP_CONFIG.trialDays }),
    })),
  );

  // Une seule page d'accueil, traduite en cinq langues (dictionnaire
  // `landing`) : /, /en, /it, /pt, /de rendent le même composant, la langue
  // vient du middleware. Les captures et les vidéos restent en français.
  // Le sous-titre d'une vidéo (« Beauté & Esthétique · lyon ») est enregistré
  // en français par l'admin ; la catégorie, elle, a un libellé dans chaque
  // langue (businessCategories). On la retraduit à la volée, la ville reste.
  const tCategories = await getTranslations('businessCategories');
  const videos = (await chargerVideosAccueil()).map((video) => {
    if (!video.subtitle) return video;
    const [categorie, ...reste] = video.subtitle.split(' · ');
    const id = CATEGORIES.find((c) => c.label === categorie)?.id;
    return id ? { ...video, subtitle: [tCategories(id), ...reste].join(' · ') } : video;
  });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingV1 videos={videos} />
    </>
  );
}
