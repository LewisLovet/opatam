import type { Metadata } from 'next';
import LandingPage from './HomePage';

export const metadata: Metadata = {
  title: 'Opatam — Réservation en ligne pour professionnels | Sans commission',
  description:
    'Opatam est la plateforme de réservation en ligne sans commission pour les professionnels de la beauté, bien-être, coaching et services. Agenda en ligne, rappels automatiques, page de réservation. Essai gratuit.',
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
  openGraph: {
    title: 'Opatam — Réservation en ligne sans commission',
    description:
      'Gérez vos rendez-vous en ligne, attirez de nouveaux clients et développez votre activité. 0% de commission. Essai gratuit.',
    url: 'https://opatam.com',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Opatam',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Opatam — Réservation en ligne sans commission',
    description:
      'Gérez vos rendez-vous en ligne, attirez de nouveaux clients et développez votre activité. 0% de commission.',
  },
  alternates: {
    canonical: 'https://opatam.com',
  },
};

// Organization + SoftwareApplication + SearchAction structured data
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Opatam',
      url: 'https://opatam.com',
      logo: 'https://opatam.com/logo.png',
      description: 'Plateforme de réservation en ligne sans commission pour les professionnels de services.',
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
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Comment fonctionne Opatam ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Créez votre page de réservation en 5 minutes. Vos clients réservent en ligne 24h/24. Vous recevez des rappels automatiques et gérez votre agenda depuis votre téléphone.',
          },
        },
        {
          '@type': 'Question',
          name: 'Est-ce qu\'Opatam prend une commission ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Non, Opatam ne prend aucune commission sur vos réservations. Vous payez un abonnement fixe à partir de 19,90€/mois.',
          },
        },
        {
          '@type': 'Question',
          name: 'Quels professionnels peuvent utiliser Opatam ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Opatam est conçu pour tous les professionnels de services : coiffeurs, esthéticiennes, masseurs, coachs, consultants, artisans, formateurs et plus de 15 secteurs d\'activité.',
          },
        },
        {
          '@type': 'Question',
          name: 'Y a-t-il un essai gratuit ?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Oui, vous bénéficiez d\'un essai gratuit sans carte bancaire. Vous pouvez tester toutes les fonctionnalités avant de vous engager.',
          },
        },
      ],
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
