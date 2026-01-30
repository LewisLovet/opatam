/**
 * Callable: recalculateNextSlot
 *
 * Fonction de test pour recalculer manuellement le nextAvailableSlot d'un provider.
 * Permet de tester la logique sans attendre un trigger.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateNextAvailableSlot } from '../utils/calculateNextAvailableSlot';
import { serverTracker } from '../utils/serverTracker';

interface RecalculateRequest {
  providerId: string;
}

interface RecalculateResponse {
  success: boolean;
  providerId: string;
  nextAvailableSlot: string | null;
  message: string;
  debug?: {
    memberFound: boolean;
    availabilitiesCount: number;
    blockedSlotsCount: number;
    futureBookingsCount: number;
  };
}

export const recalculateNextSlot = onCall(
  async (request: CallableRequest<RecalculateRequest>): Promise<RecalculateResponse> => {
    const { providerId } = request.data;

    serverTracker.startContext('recalculateNextSlot');
    console.log(`=== recalculateNextSlot called for: ${providerId} ===`);

    if (!providerId) {
      serverTracker.endContext();
      return {
        success: false,
        providerId: '',
        nextAvailableSlot: null,
        message: 'providerId est requis',
      };
    }

    const db = admin.firestore();

    try {
      // Vérifier que le provider existe
      const providerDoc = await db.collection('providers').doc(providerId).get();
      serverTracker.trackRead('providers', 1);
      if (!providerDoc.exists) {
        serverTracker.endContext();
        return {
          success: false,
          providerId,
          nextAvailableSlot: null,
          message: `Provider ${providerId} non trouvé`,
        };
      }

      const providerData = providerDoc.data();

      // Récupérer des infos de debug
      const membersSnapshot = await db
        .collection('providers')
        .doc(providerId)
        .collection('members')
        .where('isActive', '==', true)
        .get();
      serverTracker.trackRead('providers/*/members', membersSnapshot.size);

      const memberId = membersSnapshot.docs[0]?.id;

      let availabilitiesCount = 0;
      let blockedSlotsCount = 0;
      let futureBookingsCount = 0;

      if (memberId) {
        // Note: la collection s'appelle 'availability' (singulier)
        const availabilitiesSnapshot = await db
          .collection('providers')
          .doc(providerId)
          .collection('availability')
          .where('memberId', '==', memberId)
          .get();
        serverTracker.trackRead('providers/*/availability', availabilitiesSnapshot.size);
        availabilitiesCount = availabilitiesSnapshot.size;

        const blockedSlotsSnapshot = await db
          .collection('providers')
          .doc(providerId)
          .collection('blockedSlots')
          .where('memberId', '==', memberId)
          .get();
        serverTracker.trackRead('providers/*/blockedSlots', blockedSlotsSnapshot.size);
        blockedSlotsCount = blockedSlotsSnapshot.size;

        const bookingsSnapshot = await db
          .collection('bookings')
          .where('providerId', '==', providerId)
          .where('memberId', '==', memberId)
          .where('status', '==', 'confirmed')
          .get();
        serverTracker.trackRead('bookings', bookingsSnapshot.size);
        futureBookingsCount = bookingsSnapshot.docs.filter(
          doc => doc.data().datetime.toDate() >= new Date()
        ).length;
      }

      // Calculer le prochain slot (a son propre tracking interne)
      const nextSlot = await calculateNextAvailableSlot(providerId);

      // Mettre à jour le provider
      await db.collection('providers').doc(providerId).update({
        nextAvailableSlot: nextSlot ? Timestamp.fromDate(nextSlot) : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      serverTracker.trackWrite('providers', 1);

      serverTracker.endContext();
      return {
        success: true,
        providerId,
        nextAvailableSlot: nextSlot?.toISOString() || null,
        message: nextSlot
          ? `Prochain créneau disponible: ${nextSlot.toLocaleDateString('fr-FR')}`
          : 'Aucun créneau disponible dans les 60 prochains jours',
        debug: {
          memberFound: !!memberId,
          availabilitiesCount,
          blockedSlotsCount,
          futureBookingsCount,
        },
      };
    } catch (error) {
      console.error('Error in recalculateNextSlot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

      serverTracker.endContext();
      return {
        success: false,
        providerId,
        nextAvailableSlot: null,
        message: `Erreur: ${errorMessage}`,
      };
    }
  }
);
