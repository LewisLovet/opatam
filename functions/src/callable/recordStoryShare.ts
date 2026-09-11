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
/** Semaine ISO « 2026-W37 » — identique à storyWeekKey (packages/shared). */
function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const recordStoryShare = onCall({ region: 'europe-west1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Connexion requise');

  const { providerId, content, channel, nonce } = (request.data ?? {}) as {
    providerId?: string;
    content?: string;
    channel?: string;
    /** Identifiant aléatoire par action : une relance réseau ne compte pas deux fois. */
    nonce?: string;
  };
  if (!providerId) throw new HttpsError('invalid-argument', 'providerId requis');
  // Provider.id === User.id — pas de lecture supplémentaire nécessaire.
  if (providerId !== uid) {
    throw new HttpsError('permission-denied', 'Un prestataire ne compte que ses propres partages');
  }
  const CONTENTS = ['services', 'availabilities', 'review', 'loyalty', 'none', 'realisation', 'avantApres'];
  const CHANNELS = ['instagram', 'system'];
  if (!CONTENTS.includes(content ?? '') || !CHANNELS.includes(channel ?? '')) {
    throw new HttpsError('invalid-argument', 'content/channel invalide');
  }

  const db = admin.firestore();
  const providerRef = db.collection('providers').doc(providerId);

  // Anti-doublon léger : même contenu + même canal à moins de 10 s du
  // précédent = une relance, pas un second partage. Lu sur le compteur
  // dénormalisé, sans index.
  const snap = await providerRef.get();
  const st = snap.data()?.stats?.stories ?? {};
  const lastAt: Date | undefined = st.lastSharedAt?.toDate?.();
  if (
    lastAt &&
    Date.now() - lastAt.getTime() < 10_000 &&
    st.lastContent === content &&
    st.lastChannel === channel
  ) {
    return { success: true, deduplicated: true };
  }

  // Le nonce devient l'identifiant du document : un second appel avec le
  // même nonce échoue à la création et ne compte rien.
  const nonceOk = typeof nonce === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(nonce);
  const eventRef = nonceOk ? db.collection('storyEvents').doc(`${providerId}_${nonce}`) : db.collection('storyEvents').doc();
  try {
    await eventRef.create({
      providerId,
      content,
      channel,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 6 /* ALREADY_EXISTS */) {
      return { success: true, deduplicated: true };
    }
    throw e;
  }

  await Promise.all([
    providerRef.update({
      'stats.stories.lastContent': content,
      'stats.stories.lastChannel': channel,
      'stats.stories.shared': admin.firestore.FieldValue.increment(1),
      'stats.stories.lastSharedAt': admin.firestore.FieldValue.serverTimestamp(),
      // Compteurs par type et par période — base des objectifs de partage
      // (packages/shared utils/storyGoals). Mêmes clés que storyWeekKey /
      // storyMonthKey, recopiées ici pour ne pas dépendre du build partagé.
      [`stats.stories.byContent.${content}`]: admin.firestore.FieldValue.increment(1),
      [`stats.stories.byWeek.${weekKey(new Date())}`]: admin.firestore.FieldValue.increment(1),
      [`stats.stories.byMonth.${monthKey(new Date())}`]: admin.firestore.FieldValue.increment(1),
    }),
  ]);

  return { success: true };
});
