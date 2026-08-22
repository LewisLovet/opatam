import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { serverTracker } from '../utils/serverTracker';
import { notifyProviderDailyAgenda } from '../notifications/bookingNotifications';
import { decideMorningAgenda, providerTimeZone, MORNING_HOUR } from '../lib/morningAgenda';

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
 * HORAIRE. Le cron tourne toutes les heures et n'envoie à un prestataire que
 * lorsqu'il est 8 h CHEZ LUI — la première version, planifiée à 8 h
 * Europe/Paris, réveillait le Portugal à 7 h et lui annonçait ses rendez-vous
 * avec une heure d'avance. Le marqueur `morningAgendaSentOn` (date locale)
 * garantit un envoi par jour. Toute la décision vit dans `decideMorningAgenda`,
 * pure et testée.
 */
export const sendProviderMorningAgenda = onSchedule(
  {
    schedule: 'every 1 hours',
    timeZone: 'Europe/Paris', // sans effet sur la sélection : repère du planificateur
    region: 'europe-west1',
  },
  async () => {
    const startTime = Date.now();
    console.log('=== sendProviderMorningAgenda started ===');
    serverTracker.startContext('sendProviderMorningAgenda');

    try {
      const db = admin.firestore();
      const now = new Date();

      // Fenêtre : on n'agit que sur les prestataires dont il est 8 h locales,
      // donc leur journée locale s'étend de -8 h à +16 h autour de maintenant.
      // Une heure de marge de part et d'autre couvre tous les fuseaux servis.
      const from = new Date(now.getTime() - 9 * 3600_000);
      const to = new Date(now.getTime() + 17 * 3600_000);

      // Une requête pour TOUTE la plateforme, groupée ensuite par prestataire
      // — même règle que le moteur de créneaux : jamais une requête par tête.
      const snapshot = await db
        .collection('bookings')
        .where('status', 'in', ['confirmed', 'pending'])
        .where('datetime', '>=', Timestamp.fromDate(from))
        .where('datetime', '<=', Timestamp.fromDate(to))
        .orderBy('datetime', 'asc')
        .get();
      serverTracker.trackRead('bookings', snapshot.size);

      const byProvider = new Map<string, Date[]>();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.demoSeed) continue; // résas de démo : clients fictifs
        const list = byProvider.get(data.providerId);
        if (list) list.push(data.datetime.toDate());
        else byProvider.set(data.providerId, [data.datetime.toDate()]);
      }

      if (byProvider.size === 0) {
        console.log('Aucune réservation dans la fenêtre — rien à faire.');
        serverTracker.endContext();
        return;
      }

      // Les fiches des seuls prestataires concernés, en une lecture groupée.
      const refs = [...byProvider.keys()].map((id) => db.collection('providers').doc(id));
      const providerDocs = await db.getAll(...refs);
      serverTracker.trackRead('providers', providerDocs.length);

      let sent = 0;
      let skipped = 0;
      for (const providerDoc of providerDocs) {
        if (!providerDoc.exists) continue;
        const providerId = providerDoc.id;
        const p = providerDoc.data()!;
        const timeZone = providerTimeZone(p.countryCode);

        const decision = decideMorningAgenda({
          now,
          timeZone,
          // Absent = activé. Lu sur la fiche déjà en main : `notifyProvider…`
          // revérifie de son côté, mais trancher ici évite une seconde
          // lecture Firestore et surtout le marqueur posé à tort.
          enabled: p.settings?.notificationPreferences?.dailyAgendaPush !== false,
          lastSentOn: p.morningAgendaSentOn,
          bookingTimes: byProvider.get(providerId) ?? [],
        });

        if (!decision.send) {
          if (decision.reason !== 'pas-l-heure') {
            console.log(`${providerId} (${timeZone}) : ${decision.reason}`);
          }
          skipped++;
          continue;
        }

        try {
          await notifyProviderDailyAgenda(providerId, decision.count, decision.firstTime);
          // Marqueur écrit APRÈS l'envoi : un échec réseau laisse la porte
          // ouverte au passage horaire suivant plutôt que d'avaler la journée.
          await providerDoc.ref.update({ morningAgendaSentOn: decision.today });
          serverTracker.trackWrite('providers', 1);
          sent++;
          console.log(`${providerId} (${timeZone}) : ${decision.count} RDV, premier à ${decision.firstTime}`);
        } catch (error) {
          console.error(`Error notifying provider ${providerId}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `=== sendProviderMorningAgenda completed: ${sent} notifié(s), ${skipped} hors ${MORNING_HOUR} h locales ou déjà servis, en ${duration}s ===`,
      );
      serverTracker.endContext();
    } catch (error) {
      console.error('sendProviderMorningAgenda failed:', error);
      throw error;
    }
  },
);
