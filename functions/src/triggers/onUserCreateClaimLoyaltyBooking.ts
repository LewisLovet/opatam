/**
 * onUserCreateClaimLoyaltyBooking — à l'inscription d'un client, crédite
 * UNIQUEMENT la réservation qui a mené à l'inscription (la plus récente),
 * jamais le reste de l'historique invité (décision produit 2026-07-20 :
 * les invités ne cumulent pas de points de fidélité ; on ne récupère que
 * la presta qui a conduit à l'inscription).
 *
 * Mécanique : on stampe `clientId` sur la dernière résa invitée confirmée
 * (post-lancement fidélité) portant l'email du nouveau compte. Le trigger
 * onBookingWriteProviderStats recalcule alors la fiche ProviderClient et
 * son `loyaltyConfirmedCount` passe à 1 — aucune écriture de compteur ici.
 *
 * Best-effort : tout échec est loggé, jamais bloquant pour l'inscription.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Miroir de packages/shared/src/utils/loyalty.ts — garder en phase.
const LOYALTY_LAUNCH_AT = new Date('2026-07-20T00:00:00+02:00');

export const onUserCreateClaimLoyaltyBooking = onDocumentCreated(
  {
    document: 'users/{uid}',
    region: 'europe-west1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const uid = event.params.uid;
    const user = snapshot.data();
    // Seuls les comptes CLIENT réclament une résa (un pro qui s'inscrit
    // n'a pas de carte de fidélité chez lui-même).
    if (user.role && user.role !== 'client') return;
    const email = (user.email as string | undefined)?.toLowerCase().trim();
    if (!email) return;

    try {
      const db = admin.firestore();
      // Même pattern de requête que recomputeClientDoc (index simple sur
      // clientInfo.email) — filtres et tri en mémoire pour éviter un
      // index composite.
      const snap = await db
        .collection('bookings')
        .where('clientInfo.email', '==', email)
        .get();

      const candidates = snap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .filter((b) => {
          const createdAt = (b.data.createdAt?.toDate?.() ?? new Date(0)) as Date;
          return (
            !b.data.clientId &&
            b.data.status === 'confirmed' &&
            createdAt.getTime() >= LOYALTY_LAUNCH_AT.getTime()
          );
        })
        .sort(
          (a, b) =>
            (b.data.createdAt?.toDate?.()?.getTime() ?? 0) -
            (a.data.createdAt?.toDate?.()?.getTime() ?? 0),
        );

      if (candidates.length === 0) return;

      // LA plus récente uniquement — « la presta qui a conduit à
      // l'inscription », pas les autres.
      const latest = candidates[0];
      await db.collection('bookings').doc(latest.id).update({ clientId: uid });
      console.log(
        `[claimLoyaltyBooking] ${uid} ← booking ${latest.id} (${candidates.length - 1} autres résas invitées NON créditées)`,
      );
    } catch (e) {
      console.error('[claimLoyaltyBooking] échec (non bloquant):', e);
    }
  },
);
