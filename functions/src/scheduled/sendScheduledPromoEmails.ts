/**
 * Scheduled: sendScheduledPromoEmails
 *
 * Rattrape les promotions PROGRAMMÉES. Le trigger d'écriture ne se déclenche
 * qu'au moment où le pro enregistre son offre : s'il programme une promo pour
 * le mois suivant, plus rien ne se produit à la date de début et l'email
 * n'était jamais envoyé. Ce cron passe chaque matin et reprend les offres
 * devenues actives dans la nuit.
 *
 * Il partage `runPromoEmailForService` avec le trigger, donc : mêmes règles
 * (choix explicite du pro, opt-in client, throttle 7 j) et même idempotence
 * par signature — une offre déjà notifiée par le trigger ressort en
 * `already-sent` et n'est pas renvoyée.
 *
 * Parcours : prestataires à fidélité activée, puis leurs prestations avec
 * `discount.notifyLoyaltyClients == true`. Volontairement pas de requête
 * `collectionGroup` : elle exigerait un index à portée groupe (aucun dans ce
 * projet), alors que les deux requêtes utilisées ici sont couvertes par les
 * index simples automatiques.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { runPromoEmailForService, type PromoRunOutcome } from '../lib/promoEmailRunner';

export const sendScheduledPromoEmails = onSchedule(
  {
    // 9 h à Paris : l'email arrive le jour même où la promo devient active.
    schedule: '0 9 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    const providersSnap = await db
      .collection('providers')
      .where('settings.loyalty.enabled', '==', true)
      .get();

    const tally: Partial<Record<PromoRunOutcome, number>> = {};

    for (const providerDoc of providersSnap.docs) {
      const servicesSnap = await providerDoc.ref
        .collection('services')
        .where('discount.notifyLoyaltyClients', '==', true)
        .get();

      for (const serviceDoc of servicesSnap.docs) {
        try {
          const outcome = await runPromoEmailForService(
            providerDoc.id,
            serviceDoc.id,
            serviceDoc.data(),
            now,
          );
          tally[outcome] = (tally[outcome] ?? 0) + 1;
        } catch (e) {
          console.error(
            `[promoEmailCron] échec ${providerDoc.id}/${serviceDoc.id}:`,
            e,
          );
        }
      }
    }

    console.log(
      `[promoEmailCron] ${providersSnap.size} prestataire(s) examiné(s) —`,
      JSON.stringify(tally),
    );
  },
);
