/**
 * onServiceDiscountPromoEmail — fidélité v2 M3.
 *
 * Quand un pro met en ligne une promo sur une prestation ET demande
 * explicitement d'en informer ses clients (`discount.notifyLoyaltyClients`),
 * email aux clients qui ont coché l'opt-in promos (`promoEmailsOptIn`) chez
 * ce prestataire.
 *
 * Ce fichier ne fait plus que l'aiguillage : toute la logique (décision,
 * throttle, destinataires, envoi) vit dans `lib/promoEmailRunner`, partagée
 * avec le cron `sendScheduledPromoEmails` qui rattrape les promos
 * programmées. Deux implémentations séparées auraient fini par diverger —
 * c'est précisément ce qui faisait qu'une promo programmée n'était jamais
 * notifiée.
 *
 * Idempotence : la signature de l'offre est posée dans un registre à part
 * (`providers/{id}/promoNotifications/{serviceId}`), dans la même
 * transaction que le throttle. Le registre étant hors de la prestation,
 * cette écriture ne redéclenche pas ce trigger.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { runPromoEmailForService } from '../lib/promoEmailRunner';

export const onServiceDiscountPromoEmail = onDocumentWritten(
  {
    document: 'providers/{providerId}/services/{serviceId}',
    region: 'europe-west1',
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return; // suppression de presta

    const { providerId, serviceId } = event.params;
    const outcome = await runPromoEmailForService(providerId, serviceId, after);
    if (outcome !== 'sent') {
      console.log(`[promoEmail] ${providerId}/${serviceId}: ${outcome}`);
    }
  },
);
