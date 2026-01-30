/**
 * Utility: calculateNextAvailableSlot
 *
 * Calcule la prochaine date disponible pour un provider.
 * Prend en compte les availabilities, blockedSlots et bookings existants.
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { serverTracker } from './serverTracker';

interface TimeSlot {
  start: string;
  end: string;
}

interface Availability {
  memberId: string;
  dayOfWeek: number;
  slots: TimeSlot[];
  isOpen: boolean;
}

interface BlockedSlot {
  memberId: string;
  startDate: admin.firestore.Timestamp;
  endDate: admin.firestore.Timestamp;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

interface Booking {
  datetime: admin.firestore.Timestamp;
  endDatetime: admin.firestore.Timestamp;
  status: string;
}

export async function calculateNextAvailableSlot(providerId: string): Promise<Date | null> {
  const db = admin.firestore();

  console.log(`Calculating nextAvailableSlot for provider: ${providerId}`);

  // 1. Vérifier que le provider existe
  const providerDoc = await db.collection('providers').doc(providerId).get();
  serverTracker.trackRead('providers', 1);
  if (!providerDoc.exists) {
    console.log('Provider not found');
    return null;
  }

  // 2. Récupérer le premier membre actif
  const membersSnapshot = await db
    .collection('providers')
    .doc(providerId)
    .collection('members')
    .where('isActive', '==', true)
    .where('isDefault', '==', true)
    .limit(1)
    .get();
  serverTracker.trackRead('providers/*/members', membersSnapshot.size);

  // Si pas de membre par défaut, prendre le premier actif
  let memberDoc = membersSnapshot.docs[0];
  if (!memberDoc) {
    const anyMemberSnapshot = await db
      .collection('providers')
      .doc(providerId)
      .collection('members')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    serverTracker.trackRead('providers/*/members', anyMemberSnapshot.size);
    memberDoc = anyMemberSnapshot.docs[0];
  }

  if (!memberDoc) {
    console.log('No active member found');
    return null;
  }

  const memberId = memberDoc.id;
  console.log(`Using member: ${memberId}`);

  // 3. Récupérer les availabilities du membre
  // Note: la collection s'appelle 'availability' (singulier)
  const availabilitiesSnapshot = await db
    .collection('providers')
    .doc(providerId)
    .collection('availability')
    .where('memberId', '==', memberId)
    .get();
  serverTracker.trackRead('providers/*/availability', availabilitiesSnapshot.size);

  const availabilities = new Map<number, Availability>();
  availabilitiesSnapshot.docs.forEach(doc => {
    const data = doc.data() as Availability;
    availabilities.set(data.dayOfWeek, data);
  });

  console.log(`Found ${availabilities.size} availability rules`);

  if (availabilities.size === 0) {
    console.log('No availabilities configured');
    return null;
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
  serverTracker.trackRead('providers/*/blockedSlots', blockedSlotsSnapshot.size);

  const blockedSlots = blockedSlotsSnapshot.docs.map(doc => doc.data() as BlockedSlot);
  console.log(`Found ${blockedSlots.length} blocked slots`);

  // 5. Récupérer les bookings futurs (2 requêtes séparées pour éviter le problème d'index)
  const pendingBookingsSnapshot = await db
    .collection('bookings')
    .where('providerId', '==', providerId)
    .where('memberId', '==', memberId)
    .where('status', '==', 'pending')
    .get();
  serverTracker.trackRead('bookings', pendingBookingsSnapshot.size);

  const confirmedBookingsSnapshot = await db
    .collection('bookings')
    .where('providerId', '==', providerId)
    .where('memberId', '==', memberId)
    .where('status', '==', 'confirmed')
    .get();
  serverTracker.trackRead('bookings', confirmedBookingsSnapshot.size);

  // Filtrer pour ne garder que les futurs
  const allBookings = [
    ...pendingBookingsSnapshot.docs,
    ...confirmedBookingsSnapshot.docs,
  ];

  const futureBookings = allBookings
    .map(doc => doc.data() as Booking)
    .filter(b => b.datetime.toDate() >= now);

  console.log(`Found ${futureBookings.length} future bookings`);

  // 6. Parcourir les 60 prochains jours
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Si on est déjà tard dans la journée, commencer demain
  const nowHours = now.getHours();
  const startOffset = nowHours >= 18 ? 1 : 0;

  for (let i = startOffset; i < 60; i++) {
    const checkDate = new Date(currentDate);
    checkDate.setDate(checkDate.getDate() + i);

    const dayOfWeek = checkDate.getDay();
    const availability = availabilities.get(dayOfWeek);

    // Jour fermé ?
    if (!availability || !availability.isOpen || !availability.slots?.length) {
      continue;
    }

    // Jour bloqué (allDay) ?
    const isBlocked = blockedSlots.some(bs => {
      const startDate = bs.startDate.toDate();
      const endDate = bs.endDate.toDate();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return bs.allDay && checkDate >= startDate && checkDate <= endDate;
    });

    if (isBlocked) {
      continue;
    }

    // Compter les bookings ce jour
    const dayBookings = futureBookings.filter(b => {
      const bookingDate = b.datetime.toDate();
      return bookingDate.toDateString() === checkDate.toDateString();
    });

    // Calculer le temps total disponible en minutes
    const totalSlotMinutes = availability.slots.reduce((sum, slot) => {
      const [startH, startM] = slot.start.split(':').map(Number);
      const [endH, endM] = slot.end.split(':').map(Number);
      return sum + (endH * 60 + endM) - (startH * 60 + startM);
    }, 0);

    // Calculer le temps réservé
    const bookedMinutes = dayBookings.reduce((sum, b) => {
      const start = b.datetime.toDate();
      const end = b.endDatetime.toDate();
      return sum + (end.getTime() - start.getTime()) / 60000;
    }, 0);

    // S'il reste du temps disponible
    const availableMinutes = totalSlotMinutes - bookedMinutes;
    const minServiceDuration = 30; // Durée minimum d'un service

    if (availableMinutes >= minServiceDuration) {
      console.log(`Found available date: ${checkDate.toISOString()} (${availableMinutes} minutes available)`);
      return checkDate;
    }
  }

  console.log('No available slot found in the next 60 days');
  return null;
}
