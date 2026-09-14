import { getAdminFirestore } from '@/lib/firebase-admin';
import type { LandingVideoItem } from '@booking-app/shared';
import type { ProviderVideo } from './ProviderVideos';

/**
 * La sélection de vidéos publiée pour l'accueil (`landingVideos/home`),
 * lue côté serveur avec l'Admin SDK. Seuls les champs d'affichage passent
 * au client — jamais les métadonnées d'administration. Une lecture qui
 * échoue rend une liste vide : la section se masque, la page tient.
 */
export async function chargerVideosAccueil(): Promise<ProviderVideo[]> {
  let items: LandingVideoItem[] = [];
  try {
    const selection = await getAdminFirestore().collection('landingVideos').doc('home').get();
    const stored = selection.data()?.items;
    if (Array.isArray(stored)) items = stored;
  } catch {
    console.warn('[accueil] Sélection de vidéos indisponible ; section masquée.');
  }
  return items
    .filter(item => item.published === true && Boolean(item.src))
    .sort((a, b) => a.order - b.order)
    .map(({ id, kind, src, youtubeId, poster, providerSlug, businessName, subtitle, photoURL, quote }) => ({
      id, src, poster, providerSlug, businessName,
      kind: kind ?? 'file', youtubeId: youtubeId ?? null,
      subtitle: subtitle ?? null, photoURL: photoURL ?? null, quote: quote ?? null,
    }));
}
