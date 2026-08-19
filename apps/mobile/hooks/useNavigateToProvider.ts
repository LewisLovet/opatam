/**
 * useNavigateToProvider — ouvre la fiche d'un prestataire.
 *
 * La navigation est immédiate ; les images se préchargent derrière, dans le
 * cache d'expo-image que la fiche partage.
 */

import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useProvidersCache } from '../contexts';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const preloadedImages = new Set<string>();

export function useNavigateToProvider() {
  const router = useRouter();
  const { getCachedProvider, fetchProviderBySlug, addToCache } = useProvidersCache();
  /**
   * On navigue TOUT DE SUITE, et on précharge derrière.
   *
   * Le préchargement était attendu avant de pousser l'écran : le doigt
   * quittait la carte et il ne se passait rien, le temps que la photo de
   * couverture et le logo descendent de Firebase Storage. Sur réseau lent le
   * tap paraissait ignoré, et l'utilisateur retapait.
   *
   * Or la fiche a son propre écran d'attente, à la photo et au nom du salon,
   * affiché au moins une seconde. C'est exactement le bon endroit pour vivre
   * cette attente : elle y est visible, tenue, et on sait quoi on attend.
   * L'y montrer vaut mieux que de bloquer le tap avant elle.
   *
   * Le préchargement reste utile — expo-image partage son cache avec la
   * fiche, qui lit désormais le MÊME (elle affichait l'image avec le `Image`
   * de react-native, dont le cache est distinct : le préchargement ne
   * servait à rien). Il n'a simplement plus à être attendu.
   */
  const navigateToProvider = useCallback(
    (slug: string, connu?: WithId<Provider>) => {
      // L'appelant a déjà le prestataire sous les yeux — c'est une carte de
      // liste. On le dépose dans le cache AVANT de pousser l'écran, pour que
      // l'écran d'attente de la fiche ait tout de suite le nom et la photo.
      //
      // `useNearbyProviders` appelle `providerService` en direct et
      // n'alimentait pas ce cache : depuis l'accueil, la fiche s'ouvrait donc
      // sur une pastille vide et sans nom, en attendant sa propre lecture.
      // Depuis la recherche, qui passe par le cache, l'écran était déjà
      // complet — d'où un défaut qui ne se voyait que sur un chemin.
      if (connu) addToCache(connu);
      router.push(`/(client)/provider/${slug}`);

      if (preloadedImages.has(slug)) return;

      void (async () => {
        try {
          // La lecture alimente aussi le cache de prestataires, où la fiche
          // prend le nom et la photo de son écran d'attente.
          const provider = getCachedProvider(slug) ?? (await fetchProviderBySlug(slug));
          if (!provider) return;

          const imageUrls = [provider.coverPhotoURL, provider.photoURL].filter(
            (url): url is string => !!url && url.length > 0
          );
          if (imageUrls.length > 0) {
            await Image.prefetch(imageUrls);
          }
          preloadedImages.add(slug);
        } catch (error) {
          // Une vignette manquante ne doit pas remonter : l'écran est déjà
          // affiché et se charge de son propre chargement.
          console.warn('Préchargement des images du prestataire:', error);
        }
      })();
    },
    [router, getCachedProvider, fetchProviderBySlug, addToCache]
  );

  // Plus d'indicateur de chargement à exposer : l'écran s'ouvre au tap, et
  // l'attente se vit désormais sur l'écran d'attente de la fiche.
  return { navigateToProvider };
}
