import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

/**
 * Comptabilise le partage d'une story : un événement daté + le compteur
 * dénormalisé sur le prestataire.
 *
 * POURQUOI UNE CALLABLE : le compteur vit dans `providers/{id}.stats`, que
 * l'allowlist Firestore interdit désormais au SDK client — un compteur
 * destiné à récompenser l'activité ne peut pas être gonflable depuis la
 * console du navigateur. L'événement `storyEvents` reste en écriture client
 * (append-only, règle dédiée), mais le compteur passe par ici.
 *
 * Auth : chaque prestataire n'inscrit que pour LUI-MÊME — même règle que la
 * règle Firestore de `storyEvents`.
 */
export const recordStoryShare = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise');

  const { providerId, content, channel } = (request.data ?? {}) as {
    providerId?: string;
    content?: string;
    channel?: string;
  };
  if (!providerId) throw new HttpsError('invalid-argument', 'providerId requis');
  // Provider.id === User.id — pas de lecture supplémentaire nécessaire.
  if (providerId !== uid) {
    throw new HttpsError('permission-denied', 'Un prestataire ne compte que ses propres partages');
  }
  const CONTENTS = ['services', 'availabilities', 'review', 'loyalty', 'none'];
  const CHANNELS = ['instagram', 'system'];
  if (!CONTENTS.includes(content ?? '') || !CHANNELS.includes(channel ?? '')) {
    throw new HttpsError('invalid-argument', 'content/channel invalide');
  }

  const db = admin.firestore();
  await Promise.all([
    db.collection('storyEvents').add({
      providerId,
      content,
      channel,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
    db.collection('providers').doc(providerId).update({
      'stats.stories.shared': admin.firestore.FieldValue.increment(1),
      'stats.stories.lastSharedAt': admin.firestore.FieldValue.serverTimestamp(),
    }),
  ]);

  return { success: true };
});
