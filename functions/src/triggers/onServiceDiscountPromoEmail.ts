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
    const before = event.data?.before?.data();

    // N'agir que si ce qui FONDE la décision a changé : la promo elle-même
    // (création, paramètres, retrait) ou la prestation qui redevient
    // réservable. Toute autre écriture — traduction, réordonnancement,
    // photo, prix — rejouait la décision et pouvait expédier une campagne
    // au nom du pro sans qu'il ait rien demandé (constaté sur des
    // traductions, 2026-08-16). Les promos programmées restent couvertes
    // par le cron sendScheduledPromoEmails.
    if (before && !promoInputsChanged(before, after)) {
      return;
    }

    const { providerId, serviceId } = event.params;
    const outcome = await runPromoEmailForService(providerId, serviceId, after);
    if (outcome !== 'sent') {
      console.log(`[promoEmail] ${providerId}/${serviceId}: ${outcome}`);
    }
  },
);

/** Vrai si la promo a changé, ou si la prestation vient de redevenir réservable. */
export function promoInputsChanged(
  before: FirebaseFirestore.DocumentData,
  after: FirebaseFirestore.DocumentData,
): boolean {
  if (stableJson(before.discount ?? null) !== stableJson(after.discount ?? null)) return true;
  const wasBookable = before.isAvailable !== false && before.isActive !== false;
  const isBookable = after.isAvailable !== false && after.isActive !== false;
  return !wasBookable && isBookable;
}

/** JSON à clés triées : deux objets égaux donnent la même chaîne, quel que soit l'ordre d'écriture. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof (v as { toMillis?: unknown }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
      return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, k) => { acc[k] = (v as Record<string, unknown>)[k]; return acc; }, {});
    }
    return v;
  });
}
