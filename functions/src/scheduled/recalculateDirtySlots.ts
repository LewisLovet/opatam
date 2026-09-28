/**
 * Recalcule la « prochaine disponibilité » des prestataires marqués.
 *
 * Le marquage vient de `onBlockedSlotWriteNextSlot` : un blocage a bougé,
 * la valeur affichée ne veut plus rien dire. On passe toutes les cinq
 * minutes plutôt qu'à chaque écriture, pour qu'une répétition de
 * cinquante-deux week-ends coûte UN balayage d'agenda et non cinquante-deux
 * — et pour qu'il ait lieu une fois la série entièrement écrite.
 *
 * Le drapeau est levé AVANT le calcul : si un blocage change pendant qu'on
 * calcule, il remarque le prestataire et la passe suivante reprendra. Le
 * marquer après aurait effacé cette demande-là.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { calculateNextAvailableSlot } from '../utils/calculateNextAvailableSlot';

/** Assez pour absorber une rafale, assez peu pour tenir dans le temps imparti. */
const MAX_PAR_PASSAGE = 40;
const EN_PARALLELE = 10;

export const recalculateDirtySlots = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const snap = await db
      .collection('providers')
      .where('nextSlotDirty', '==', true)
      .limit(MAX_PAR_PASSAGE)
      .get();
    if (snap.empty) return;
    console.log(`[recalculateDirtySlots] ${snap.size} prestataire(s) à recalculer`);

    const traiter = async (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const ref = doc.ref;
      try {
        // Le drapeau tombe d'abord : une modification pendant le calcul
        // le relèvera, et sera donc reprise au passage suivant.
        await ref.update({ nextSlotDirty: FieldValue.delete(), nextSlotDirtyAt: FieldValue.delete() });
        const slot = await calculateNextAvailableSlot(doc.id);
        await ref.update({
          nextAvailableSlot: slot ? Timestamp.fromDate(slot) : null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(`[recalculateDirtySlots] ${doc.id} échec`, err);
      }
    };

    for (let i = 0; i < snap.docs.length; i += EN_PARALLELE) {
      await Promise.all(snap.docs.slice(i, i + EN_PARALLELE).map(traiter));
    }
  },
);
