import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/config';

/**
 * Suivi des stories : qui en produit, lesquelles, et sur quel canal.
 *
 * DEUX ÉCRITURES, et elles ne servent pas la même question :
 *
 *  - un COMPTEUR sur le prestataire, pour l'afficher dans son espace sans
 *    parcourir un historique à chaque ouverture ;
 *  - un ÉVÉNEMENT daté par partage, pour répondre plus tard à « qui est le
 *    plus actif sur les réseaux » — une question qui porte sur une période et
 *    qu'un compteur seul, sans date ni nature, ne saurait pas trancher.
 *
 * Best-effort de bout en bout : une story partagée ne doit jamais échouer
 * parce que sa comptabilisation a échoué. L'erreur est journalisée et avalée,
 * comme pour le reste de la mesure d'audience.
 *
 * AUCUNE DONNÉE PERSONNELLE : le prestataire, la nature du contenu, le canal.
 * Ni l'avis retenu, ni le nom d'une cliente, ni l'image.
 */

/** Ce que la story montrait. Reprend les modes de la modale de partage. */
export type StoryContent =
  | 'services'
  | 'availabilities'
  | 'review'
  | 'loyalty'
  | 'none';

/** Par où elle est sortie. `system` = feuille de partage du téléphone. */
export type StoryChannel = 'instagram' | 'system';

class StoryTrackingService {
  async shared(
    providerId: string,
    content: StoryContent,
    channel: StoryChannel
  ): Promise<void> {
    if (!providerId) return;
    try {
      // Callable serveur : le compteur `stats.stories` n'est plus accessible
      // au SDK client (allowlist Firestore) — un compteur qui récompense
      // l'activité ne doit pas être gonflable depuis la console. L'événement
      // et le compteur sont écrits ensemble côté Admin SDK.
      const fns = getFunctions(app, 'europe-west1');
      await httpsCallable(fns, 'recordStoryShare')({ providerId, content, channel });
    } catch (e) {
      console.warn('[stories] comptabilisation du partage:', e);
    }
  }
}

export const storyTrackingService = new StoryTrackingService();
