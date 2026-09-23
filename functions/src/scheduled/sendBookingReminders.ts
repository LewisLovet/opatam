/**
 * Scheduled: sendBookingReminders
 *
 * Runs every hour to send booking reminders (push + email) to clients:
 * - 24h reminder for standard bookings
 * - 2h reminder for bookings made less than 24h before
 * - Maximum one reminder per booking (deduplication via remindersSent)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { estHeureSilencieuse } from '../lib/heuresSilencieuses';
import { ajouterJours } from '../lib/fuseaux';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { notifyClientBookingReminder, notifyProviderBookingSoon } from '../notifications/bookingNotifications';
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
    schedule: 'every 30 minutes',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 300,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('sendBookingReminders');
    console.log('=== sendBookingReminders started ===');

    // Les HEURES SILENCIEUSES se jugent réservation par réservation, chez
    // le salon — plus globalement à Paris.
    //
    // POURQUOI CE N'ÉTAIT PAS UN DÉTAIL : un rendez-vous à 8 h à La
    // Réunion demande son rappel « 2 h avant » à 6 h locales, soit 3 h du
    // matin à Paris. Le cron s'arrêtait alors tout entier, et ce rappel
    // ne partait JAMAIS — pas « en retard » : jamais. Le salon perdait
    // silencieusement tous ses rappels matinaux.

    const db = admin.firestore();
    const now = new Date();

    // Cadence 30 min SANS doubler les lectures : la grande fenêtre de 49 h
    // (rappels clients 24 h + révélation d'adresse 48 h) n'est lue qu'aux
    // passages de l'heure pleine — ces rappels-là n'ont pas besoin d'une
    // précision meilleure que l'heure. Les passages de la demi-heure ne
    // lisent que 3 h : le rappel prestataire ~1 h et le rappel client
    // imminent, seuls à profiter de la cadence resserrée.
    const fullPass = now.getMinutes() < 15;
    const windowEnd = new Date(
      now.getTime() + (fullPass ? 49 : 3) * 60 * 60 * 1000,
    );

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

      // Rappel PRESTATAIRE ~1 h avant — dédupliqué à part
      // (`providerReminderSentAt`), indépendant des rappels clientes. Le cron
      // passe toutes les 30 min : la fenêtre (0, 60] garantit UN envoi entre
      // ~30 et 60 minutes avant chaque rendez-vous.
      const providerReminders: Array<{
        id: string;
        data: FirebaseFirestore.DocumentData;
        minutesUntil: number;
      }> = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        // Résa de démo seedée : pas de rappel (clients fictifs).
        if (data.demoSeed) continue;
        const bookingDatetime = data.datetime.toDate();
        const minutesUntil = (bookingDatetime.getTime() - now.getTime()) / (1000 * 60);
        const hoursUntil = minutesUntil / 60;

        // « Aujourd'hui » et « demain » se comptent CHEZ LE SALON, pas à
        // Paris. Pour un rendez-vous réunionnais du matin, Paris est encore
        // la veille : le rappel annonçait « demain » à une cliente qui
        // passait le lendemain matin — ou l'inverse.
        //
        // Le fuseau est figé sur la réservation ; « Europe/Paris » reste le
        // repli pour celles d'avant le chantier, donc rien ne change pour
        // elles.
        const fuseauSalon = data.timezone || 'Europe/Paris';

        // 23 h–6 h CHEZ LA CLIENTE, c'est-à-dire chez le salon : on ne
        // réveille personne. Le rendez-vous, lui, n'est pas perdu — le
        // cron repasse dans l'heure et le rappel partira dès 6 h locales.
        if (estHeureSilencieuse(now, fuseauSalon)) continue;

        const jourChezLeSalon = (d: Date): string =>
          new Intl.DateTimeFormat('en-CA', {
            timeZone: fuseauSalon,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(d);

        const todayStr = jourChezLeSalon(now);
        const bookingStr = data.localDate || jourChezLeSalon(bookingDatetime);
        // « Demain » est une notion de CALENDRIER, pas de durée : sur un
        // jour de bascule, `+24 h` reste sur la même date (automne, 25 h)
        // ou en saute une (printemps, 23 h). Reproduit à New York.
        const tomorrowStr = ajouterJours(todayStr, 1);

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

        if (
          minutesUntil > 0 &&
          minutesUntil <= 60 &&
          !data.providerReminderSentAt
        ) {
          providerReminders.push({ id: doc.id, data, minutesUntil });
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
                // Le fuseau voyage avec la date : sans lui le rappel est
                // SÉLECTIONNÉ au bon moment mais RÉDIGÉ à l'heure de Paris.
                timezone: data.timezone ?? null,
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
                // Le fuseau voyage avec la date : sans lui le rappel est
                // SÉLECTIONNÉ au bon moment mais RÉDIGÉ à l'heure de Paris.
                timezone: data.timezone ?? null,
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

      // 3bis. Rappels prestataire — envoi + marqueur, best-effort par résa.
      let providerSent = 0;
      for (let i = 0; i < providerReminders.length; i += BATCH_SIZE) {
        const batch = providerReminders.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async ({ id, data, minutesUntil }) => {
            try {
              await notifyProviderBookingSoon(
                {
                  providerId: data.providerId,
                  clientId: data.clientId,
                  serviceName: data.serviceName,
                  datetime: data.datetime,
                // Le fuseau voyage avec la date : sans lui le rappel est
                // SÉLECTIONNÉ au bon moment mais RÉDIGÉ à l'heure de Paris.
                timezone: data.timezone ?? null,
                  clientInfo: data.clientInfo,
                  providerName: data.providerName,
                  status: data.status,
                },
                minutesUntil,
                id
              );
              await db.collection('bookings').doc(id).update({
                providerReminderSentAt: Timestamp.fromDate(now),
              });
              serverTracker.trackWrite('bookings', 1);
              providerSent++;
            } catch (error) {
              console.error(`[PROVIDER-REMINDER] Error for booking ${id}:`, error);
            }
          })
        );
      }
      if (providerReminders.length > 0) {
        console.log(`Provider reminders: ${providerSent}/${providerReminders.length} sent`);
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
