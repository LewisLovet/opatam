import type { Metadata, Viewport } from 'next';
import LandingV1 from './LandingV1';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { LandingVideoItem } from '@booking-app/shared';
import type { ProviderVideo } from './ProviderVideos';

export const metadata: Metadata = {
  title: { absolute: 'Opatam — Réservation en ligne sans commission | V1' },
  description: 'Votre page de réservation et votre agenda dans une seule application. Pour les indépendants et les petites équipes, sans commission.',
  robots: { index: false, follow: false },
  // Sans cette ligne, la page hérite du canonique du layout racine et se
  // déclare canonique vers l'accueil tout en étant noindex — deux signaux
  // contradictoires envoyés à Google.
  alternates: { canonical: '/v1' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true };

export const revalidate = 300;

export default async function Page() {
  // This is a server component: use the existing server credentials, not
  // the unauthenticated browser SDK. Never send drafts or admin metadata
  // to the public client, and never change the database/security rules.
  let items: LandingVideoItem[] = [];
  try {
    const selection = await getAdminFirestore().collection('landingVideos').doc('home').get();
    const stored = selection.data()?.items;
    if (Array.isArray(stored)) items = stored;
  } catch {
    // An unavailable optional editorial section must not break the landing.
    console.warn('[v1] Provider video selection unavailable; showing the presentation excerpt.');
  }
  const videos: ProviderVideo[] = items
    .filter(item => item.published === true && Boolean(item.src))
    .sort((a, b) => a.order - b.order)
    .map(({ id, kind, src, youtubeId, poster, providerSlug, businessName, subtitle, photoURL, quote }) => ({
      id, src, poster, providerSlug, businessName,
      // Renseignés par l'admin depuis l'ouverture aux liens YouTube ; absents
      // sur les entrées plus anciennes, que le client sait encore reconnaître
      // en relisant `src`.
      kind: kind ?? 'file', youtubeId: youtubeId ?? null,
      subtitle: subtitle ?? null, photoURL: photoURL ?? null, quote: quote ?? null,
    }));
  return <LandingV1 videos={videos} />;
}
