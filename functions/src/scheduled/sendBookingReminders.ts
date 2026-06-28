/**
 * Scheduled: sendBookingReminders
 *
 * Runs every hour to send booking reminders (push + email) to clients:
 * - 24h reminder for standard bookings
 * - 2h reminder for bookings made less than 24h before
 * - Maximum one reminder per booking (deduplication via remindersSent)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { notifyClientBookingReminder } from '../notifications/bookingNotifications';
import { emailClientBookingReminder } from '../notifications/bookingEmails';
import { serverTracker } from '../utils/serverTracker';

interface ReminderResult {
  bookingId: string;
  clientName: string;
  reminderType: '2h' | '24h' | '48h';
  pushSent: boolean;
  emailSent: boolean;
  error: string | null;
}

const BATCH_SIZE = 10;

export const sendBookingReminders = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 300,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('sendBookingReminders');
    console.log('=== sendBookingReminders started ===');

    // Skip reminders during quiet hours (23h–6h Paris time)
    const parisHour = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false });
    const hour = parseInt(parisHour, 10);
    if (hour >= 23 || hour < 6) {
      console.log(`Quiet hours (${hour}h Paris) — skipping reminders`);
      serverTracker.endContext();
      return;
    }

    const db = admin.firestore();
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000); // now + 49h (couvre le rappel 48h de révélation d'adresse)

    try {
      // 1. Query confirmed bookings in the reminder window
      const snapshot = await db
        .collection('bookings')
        .where('status', '==', 'confirmed')
        .where('datetime', '>=', Timestamp.fromDate(now))
        .where('datetime', '<=', Timestamp.fromDate(windowEnd))
        .orderBy('datetime', 'asc')
        .get();
      serverTracker.trackRead('bookings', snapshot.size);

      console.log(`Found ${snapshot.size} confirmed bookings in reminder window`);

      // 2. Filter bookings that need a reminder
      const bookingsToRemind: Array<{
        id: string;
        data: FirebaseFirestore.DocumentData;
        reminderType: '2h' | '24h' | '48h';
        minutesUntil: number;
        // 'near' = rappel habituel (24h/2h, 1 par résa). 'reveal' = rappel 48h
        // qui révèle l'adresse (lieux protégés uniquement), dédupliqué à part.
        kind: 'near' | 'reveal';
      }> = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const bookingDatetime = data.datetime.toDate();
        const minutesUntil = (bookingDatetime.getTime() - now.getTime()) / (1000 * 60);
        const hoursUntil = minutesUntil / 60;

        // Determine if booking is TODAY or TOMORROW in Paris timezone
        const parisNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const parisBooking = new Date(bookingDatetime.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const todayStr = `${parisNow.getFullYear()}-${parisNow.getMonth()}-${parisNow.getDate()}`;
        const bookingStr = `${parisBooking.getFullYear()}-${parisBooking.getMonth()}-${parisBooking.getDate()}`;
        const tomorrowDate = new Date(parisNow);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowStr = `${tomorrowDate.getFullYear()}-${tomorrowDate.getMonth()}-${tomorrowDate.getDate()}`;

        const isToday = todayStr === bookingStr;
        const isTomorrow = tomorrowStr === bookingStr;

        // Rappel proche (24h / 2h) — comportement inchangé : 1 par résa.
        let nearType: '2h' | '24h' | null = null;
        if (hoursUntil <= 3) {
          nearType = '2h'; // Imminent — "dans X heures"
        } else if (isToday) {
          nearType = '2h'; // Still today — use dynamic timing, NOT "demain"
        } else if (isTomorrow && hoursUntil <= 25) {
          nearType = '24h'; // Actually tomorrow — safe to say "demain"
        }

        const nearAlreadySent = (data.remindersSent || []).length > 0;
        if (nearType && !nearAlreadySent) {
          bookingsToRemind.push({ id: doc.id, data, reminderType: nearType, minutesUntil, kind: 'near' });
          continue;
        }

        // Rappel 48h de révélation d'adresse — uniquement pour un lieu protégé,
        // une seule fois, dans la fenêtre (25h, 49h]. Exclu si la résa a été
        // réservée <48h à l'avance (l'adresse a alors déjà été révélée à la
        // confirmation ≤48h) → évite un doublon avec l'email de confirmation.
        const createdAt = data.createdAt?.toDate?.();
        const bookedWellInAdvance = createdAt
          ? bookingDatetime.getTime() - createdAt.getTime() > 48 * 60 * 60 * 1000
          : true;
        if (
          data.locationProtected &&
          bookedWellInAdvance &&
          hoursUntil > 25 &&
          hoursUntil <= 49 &&
          !data.addressRevealReminderSentAt
        ) {
          bookingsToRemind.push({ id: doc.id, data, reminderType: '48h', minutesUntil, kind: 'reveal' });
        }
      }

      const skipped = snapshot.size - bookingsToRemind.length;
      console.log(`${bookingsToRemind.length} bookings need reminders, ${skipped} skipped (already sent or not in window)`);

      // 3. Process a single booking reminder
      async function processReminder(booking: {
        id: string;
        data: FirebaseFirestore.DocumentData;
        reminderType: '2h' | '24h' | '48h';
        minutesUntil: number;
        kind: 'near' | 'reveal';
      }): Promise<ReminderResult> {
        const { id, data, reminderType, minutesUntil, kind } = booking;
        const clientName = data.clientInfo?.name || 'Client';

        let pushSent = false;
        let emailSent = false;

        try {
          // Send push notification
          try {
            await notifyClientBookingReminder(
              {
                providerId: data.providerId,
                clientId: data.clientId,
                serviceName: data.serviceName,
                datetime: data.datetime,
                clientInfo: data.clientInfo,
                providerName: data.providerName,
                status: data.status,
                locationProtected: data.locationProtected,
              },
              reminderType,
              minutesUntil,
              id
            );
            pushSent = true;
          } catch (pushError) {
            console.error(`[PUSH] Error for booking ${id}:`, pushError);
          }

          // Send email
          try {
            await emailClientBookingReminder(
              {
                providerId: data.providerId,
                clientId: data.clientId,
                serviceName: data.serviceName,
                datetime: data.datetime,
                duration: data.duration,
                price: data.price,
                clientInfo: data.clientInfo,
                providerName: data.providerName,
                status: data.status,
                cancelToken: data.cancelToken,
                locationName: data.locationName,
                locationAddress: data.locationAddress,
                locationId: data.locationId,
                locationProtected: data.locationProtected,
                memberName: data.memberName,
              },
              id,
              reminderType,
              minutesUntil
            );
            emailSent = true;
          } catch (emailError) {
            console.error(`[EMAIL] Error for booking ${id}:`, emailError);
          }

          // Dédup : le rappel 48h de révélation a son propre marqueur pour ne pas
          // bloquer le rappel proche (24h/2h) qui suivra.
          if (kind === 'reveal') {
            await db.collection('bookings').doc(id).update({
              addressRevealReminderSentAt: Timestamp.fromDate(now),
            });
          } else {
            await db.collection('bookings').doc(id).update({
              remindersSent: FieldValue.arrayUnion(Timestamp.fromDate(now)),
            });
          }
          serverTracker.trackWrite('bookings', 1);

          console.log(`[${clientName}] ${reminderType} reminder sent (push: ${pushSent}, email: ${emailSent})`);
          return { bookingId: id, clientName, reminderType, pushSent, emailSent, error: null };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[${clientName}] Error:`, errorMessage);
          return { bookingId: id, clientName, reminderType, pushSent, emailSent, error: errorMessage };
        }
      }

      // 4. Process in batches of 10 in parallel
      const results: ReminderResult[] = [];
      let sent = 0;
      let errors = 0;

      for (let i = 0; i < bookingsToRemind.length; i += BATCH_SIZE) {
        const batch = bookingsToRemind.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(processReminder));

        results.push(...batchResults);
        batchResults.forEach(r => {
          if (r.error) errors++;
          else sent++;
        });

        console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(bookingsToRemind.length / BATCH_SIZE)}`);
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`=== sendBookingReminders completed in ${executionTimeMs}ms ===`);
      console.log(`Results: ${sent} sent, ${errors} errors, ${skipped} skipped`);

      serverTracker.endContext();

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error('Error in sendBookingReminders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Failed after ${executionTimeMs}ms: ${errorMessage}`);

      serverTracker.endContext();
    }
  }
);
