/**
 * Callable: testCalculateNextSlot
 *
 * Fonction de test détaillée pour analyser le calcul de nextAvailableSlot.
 * Retourne toutes les données intermédiaires pour le debug.
 * Ne modifie rien dans Firestore.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

interface TestRequest {
  providerId: string;
}

interface AvailabilityDebug {
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  slots: { start: string; end: string }[];
}

interface BlockedSlotDebug {
  startDate: string;
  endDate: string;
  allDay: boolean;
  reason: string | null;
}

interface BookingDebug {
  date: string;
  time: string;
  serviceName: string;
  status: string;
}

interface DayAnalysis {
  date: string;
  dayName: string;
  status: 'closed' | 'blocked' | 'full' | 'available';
  availableMinutes: number;
  bookedMinutes: number;
}

interface TestResult {
  success: boolean;
  providerId: string;
  nextAvailableSlot: string | null;
  member: {
    id: string;
    name: string;
    isDefault: boolean;
  } | null;
  availabilities: AvailabilityDebug[];
  blockedSlots: BlockedSlotDebug[];
  futureBookings: BookingDebug[];
  next7Days: DayAnalysis[];
  message: string;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const testCalculateNextSlot = onCall(
  async (request: CallableRequest<TestRequest>): Promise<TestResult> => {
    const { providerId } = request.data;

    console.log(`=== testCalculateNextSlot called for: ${providerId} ===`);

    if (!providerId) {
      return {
        success: false,
        providerId: '',
        nextAvailableSlot: null,
        member: null,
        availabilities: [],
        blockedSlots: [],
        futureBookings: [],
        next7Days: [],
        message: 'providerId est requis',
      };
    }

    const db = admin.firestore();

    try {
      // 1. Vérifier que le provider existe
      const providerDoc = await db.collection('providers').doc(providerId).get();
      if (!providerDoc.exists) {
        return {
          success: false,
          providerId,
          nextAvailableSlot: null,
          member: null,
          availabilities: [],
          blockedSlots: [],
          futureBookings: [],
          next7Days: [],
          message: `Provider ${providerId} non trouvé`,
        };
      }

      // 2. Récupérer le membre (d'abord default, sinon premier actif)
      const membersSnapshot = await db
        .collection('providers')
        .doc(providerId)
        .collection('members')
        .where('isActive', '==', true)
        .where('isDefault', '==', true)
        .limit(1)
        .get();

      let memberDoc = membersSnapshot.docs[0];
      let isDefaultMember = true;

      if (!memberDoc) {
        const anyMemberSnapshot = await db
          .collection('providers')
          .doc(providerId)
          .collection('members')
          .where('isActive', '==', true)
          .limit(1)
          .get();
        memberDoc = anyMemberSnapshot.docs[0];
        isDefaultMember = false;
      }

      if (!memberDoc) {
        return {
          success: false,
          providerId,
          nextAvailableSlot: null,
          member: null,
          availabilities: [],
          blockedSlots: [],
          futureBookings: [],
          next7Days: [],
          message: 'Aucun membre actif trouvé',
        };
      }

      const memberId = memberDoc.id;
      const memberData = memberDoc.data();

      const member = {
        id: memberId,
        name: memberData?.name || memberData?.firstName || 'Sans nom',
        isDefault: isDefaultMember,
      };

      // 3. Récupérer les availabilities
      const availabilitiesSnapshot = await db
        .collection('providers')
        .doc(providerId)
        .collection('availability')
        .where('memberId', '==', memberId)
        .get();

      const availabilitiesMap = new Map<number, {
        dayOfWeek: number;
        isOpen: boolean;
        slots: { start: string; end: string }[];
      }>();

      availabilitiesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        availabilitiesMap.set(data.dayOfWeek, {
          dayOfWeek: data.dayOfWeek,
          isOpen: data.isOpen,
          slots: data.slots || [],
        });
      });

      // Créer le tableau des 7 jours avec leurs availabilities
      const availabilities: AvailabilityDebug[] = [];
      for (let i = 0; i < 7; i++) {
        const av = availabilitiesMap.get(i);
        availabilities.push({
          dayOfWeek: i,
          dayName: DAY_NAMES[i],
          isOpen: av?.isOpen || false,
          slots: av?.slots || [],
        });
      }

      // 4. Récupérer les blockedSlots futurs
      const now = new Date();
      const blockedSlotsSnapshot = await db
        .collection('providers')
        .doc(providerId)
        .collection('blockedSlots')
        .where('memberId', '==', memberId)
        .where('endDate', '>=', Timestamp.fromDate(now))
        .get();

      const blockedSlots: BlockedSlotDebug[] = blockedSlotsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          startDate: data.startDate?.toDate?.()?.toISOString() || 'N/A',
          endDate: data.endDate?.toDate?.()?.toISOString() || 'N/A',
          allDay: data.allDay || false,
          reason: data.reason || null,
        };
      });

      // 5. Récupérer les bookings futurs
      const pendingBookingsSnapshot = await db
        .collection('bookings')
        .where('providerId', '==', providerId)
        .where('memberId', '==', memberId)
        .where('status', '==', 'pending')
        .get();

      const confirmedBookingsSnapshot = await db
        .collection('bookings')
        .where('providerId', '==', providerId)
        .where('memberId', '==', memberId)
        .where('status', '==', 'confirmed')
        .get();

      const allBookings = [
        ...pendingBookingsSnapshot.docs,
        ...confirmedBookingsSnapshot.docs,
      ];

      const futureBookingsData = allBookings
        .map(doc => doc.data())
        .filter(b => b.datetime?.toDate?.() >= now);

      const futureBookings: BookingDebug[] = futureBookingsData.map(b => {
        const bookingDate = b.datetime?.toDate?.();
        return {
          date: bookingDate?.toLocaleDateString('fr-FR') || 'N/A',
          time: bookingDate?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || 'N/A',
          serviceName: b.serviceName || 'Service inconnu',
          status: b.status || 'unknown',
        };
      });

      // 6. Analyser les 7 prochains jours
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const nowHours = now.getHours();
      const startOffset = nowHours >= 18 ? 1 : 0;

      const next7Days: DayAnalysis[] = [];
      let nextAvailableSlot: Date | null = null;

      for (let i = startOffset; i < startOffset + 7; i++) {
        const checkDate = new Date(currentDate);
        checkDate.setDate(checkDate.getDate() + i);

        const dayOfWeek = checkDate.getDay();
        const availability = availabilitiesMap.get(dayOfWeek);

        let status: DayAnalysis['status'] = 'closed';
        let availableMinutes = 0;
        let bookedMinutes = 0;

        // Jour fermé ?
        if (!availability || !availability.isOpen || !availability.slots?.length) {
          status = 'closed';
        } else {
          // Jour bloqué (allDay) ?
          const isBlocked = blockedSlotsSnapshot.docs.some(doc => {
            const bs = doc.data();
            const startDate = bs.startDate?.toDate?.();
            const endDate = bs.endDate?.toDate?.();
            if (!startDate || !endDate) return false;

            const startDateNorm = new Date(startDate);
            startDateNorm.setHours(0, 0, 0, 0);
            const endDateNorm = new Date(endDate);
            endDateNorm.setHours(23, 59, 59, 999);

            return bs.allDay && checkDate >= startDateNorm && checkDate <= endDateNorm;
          });

          if (isBlocked) {
            status = 'blocked';
          } else {
            // Calculer le temps total disponible
            const totalSlotMinutes = availability.slots.reduce((sum, slot) => {
              const [startH, startM] = slot.start.split(':').map(Number);
              const [endH, endM] = slot.end.split(':').map(Number);
              return sum + (endH * 60 + endM) - (startH * 60 + startM);
            }, 0);

            // Calculer le temps réservé
            const dayBookings = futureBookingsData.filter(b => {
              const bookingDate = b.datetime?.toDate?.();
              return bookingDate?.toDateString() === checkDate.toDateString();
            });

            bookedMinutes = dayBookings.reduce((sum, b) => {
              const start = b.datetime?.toDate?.();
              const end = b.endDatetime?.toDate?.();
              if (!start || !end) return sum;
              return sum + (end.getTime() - start.getTime()) / 60000;
            }, 0);

            availableMinutes = totalSlotMinutes - bookedMinutes;
            const minServiceDuration = 30;

            if (availableMinutes >= minServiceDuration) {
              status = 'available';
              if (!nextAvailableSlot) {
                nextAvailableSlot = checkDate;
              }
            } else {
              status = 'full';
            }
          }
        }

        next7Days.push({
          date: checkDate.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          }),
          dayName: DAY_NAMES[dayOfWeek],
          status,
          availableMinutes: Math.max(0, availableMinutes),
          bookedMinutes,
        });
      }

      // Construire le message
      let message = '';
      if (nextAvailableSlot) {
        message = `Prochain créneau disponible: ${nextAvailableSlot.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}`;
      } else {
        message = 'Aucun créneau disponible dans les 7 prochains jours';
      }

      return {
        success: true,
        providerId,
        nextAvailableSlot: nextAvailableSlot?.toISOString() || null,
        member,
        availabilities,
        blockedSlots,
        futureBookings,
        next7Days,
        message,
      };

    } catch (error) {
      console.error('Error in testCalculateNextSlot:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

      return {
        success: false,
        providerId,
        nextAvailableSlot: null,
        member: null,
        availabilities: [],
        blockedSlots: [],
        futureBookings: [],
        next7Days: [],
        message: `Erreur: ${errorMessage}`,
      };
    }
  }
);
