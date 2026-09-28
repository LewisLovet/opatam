/**
 * Trigger : un blocage change → la « prochaine disponibilité » est périmée.
 *
 * `provider.nextAvailableSlot` est affiché publiquement (fiche, listes,
 * recherche). Il n'était recalculé que par le cron des créneaux EXPIRÉS,
 * qui ne regarde que les valeurs passées ou nulles : bloquer son après-midi
 * laissait donc une disponibilité annoncée qui n'existait plus, jusqu'à ce
 * qu'elle devienne elle-même passée. Une répétition rend le défaut
 * systématique — on bloque cinquante-deux week-ends d'un coup.
 *
 * Ici on ne RECALCULE pas : on MARQUE. Une série écrit N occurrences, donc
 * déclenche N fois ce trigger ; recalculer à chaque fois coûterait N
 * balayages d'agenda, et les premiers liraient une série encore à moitié
 * écrite. Le drapeau est posé une seule fois (les suivants voient qu'il
 * l'est déjà et n'écrivent rien : le document prestataire ne supporte pas
 * des centaines d'écritures en rafale), et `recalculateDirtySlots` fait le
 * calcul une fois, après.
 */
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const onBlockedSlotWriteNextSlot = onDocumentWritten(
  {
    document: 'providers/{providerId}/blockedSlots/{blockedSlotId}',
    region: 'europe-west1',
  },
  async (event) => {
    const providerId = event.params.providerId as string;
    try {
      const ref = admin.firestore().collection('providers').doc(providerId);
      const snap = await ref.get();
      if (!snap.exists) return;
      // Déjà marqué : ne rien écrire. C'est ce qui rend une série de 371
      // occurrences aussi économe qu'un blocage isolé.
      if (snap.data()?.nextSlotDirty === true) return;
      await ref.update({ nextSlotDirty: true, nextSlotDirtyAt: FieldValue.serverTimestamp() });
    } catch (err) {
      // Au pire, le cron des créneaux expirés rattrapera. Ne jamais lever :
      // le trigger serait rejoué en boucle sur l'écriture du blocage.
      console.error('[onBlockedSlotWriteNextSlot] failed', err);
    }
  },
);
