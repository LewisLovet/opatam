import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { serverTracker } from '../utils/serverTracker';
import { notifyProviderDailyAgenda } from '../notifications/bookingNotifications';

/**
 * Résumé du matin, en PUSH, au prestataire : « Aujourd'hui vous avez N
 * rendez-vous. Le premier commence à HH:MM. »
 *
 * Comble le trou identifié avec Grs.hair : la seule synthèse existante est un
 * E-MAIL envoyé à 20 h pour le LENDEMAIN (sendDailyAgendaSummary) — rien ne
 * prévenait le prestataire de sa journée le jour même, sur son téléphone.
 *
 * Envoyé par défaut à tous (gate `dailyAgendaPush`, absent = activé),
 * désactivable dans les réglages de notifications. AUCUN envoi les jours
 * sans rendez-vous : un « 0 rendez-vous » quotidien serait du bruit et
 * pousserait à couper la notification.
 *
 * 8 h Europe/Paris : assez tôt pour organiser la journée, assez tard pour ne
 * réveiller personne.
 */
export const sendProviderMorningAgenda = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    const startTime = Date.now();
    console.log('=== sendProviderMorningAgenda started ===');
    serverTracker.startContext('sendProviderMorningAgenda');

    try {
      const db = admin.firestore();

      // Bornes du jour en heure de PARIS, convertie en UTC pour la requête.
      const nowParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
      const offsetMs = Date.now() - nowParis.getTime();
      const dayStartParis = new Date(nowParis);
      dayStartParis.setHours(0, 0, 0, 0);
      const dayEndParis = new Date(nowParis);
      dayEndParis.setHours(23, 59, 59, 999);
      const dayStartUtc = new Date(dayStartParis.getTime() + offsetMs);
      const dayEndUtc = new Date(dayEndParis.getTime() + offsetMs);

      // Une requête pour TOUTE la plateforme, groupée ensuite par prestataire
      // — même règle que le moteur de créneaux : jamais une requête par tête.
      const snapshot = await db
        .collection('bookings')
        .where('status', 'in', ['confirmed', 'pending'])
        .where('datetime', '>=', Timestamp.fromDate(dayStartUtc))
        .where('datetime', '<=', Timestamp.fromDate(dayEndUtc))
        .orderBy('datetime', 'asc')
        .get();
      serverTracker.trackRead('bookings', snapshot.size);

      const byProvider = new Map<string, { count: number; first: Date }>();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.demoSeed) continue; // résas de démo : clients fictifs
        const entry = byProvider.get(data.providerId);
        const dt: Date = data.datetime.toDate();
        if (!entry) byProvider.set(data.providerId, { count: 1, first: dt });
        else entry.count++;
        // orderBy datetime asc → la première occurrence EST le premier RDV.
      }

      console.log(`${snapshot.size} booking(s) today across ${byProvider.size} provider(s)`);

      let sent = 0;
      for (const [providerId, { count, first }] of byProvider) {
        try {
          const firstTime = first.toLocaleTimeString('fr-FR', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
          });
          await notifyProviderDailyAgenda(providerId, count, firstTime);
          sent++;
        } catch (error) {
          console.error(`Error notifying provider ${providerId}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`=== sendProviderMorningAgenda completed: ${sent}/${byProvider.size} notified in ${duration}s ===`);
      serverTracker.endContext();
    } catch (error) {
      console.error('sendProviderMorningAgenda failed:', error);
      throw error;
    }
  },
);
