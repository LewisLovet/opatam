/**
 * Décision d'envoi des emails de promotion — logique PURE, partagée par le
 * trigger (promo créée/modifiée) et le cron (promo programmée qui devient
 * active). Les deux doivent décider à l'identique, sinon une promo part deux
 * fois ou jamais.
 *
 * Trois défauts corrigés ici, tous constatés en production :
 *  1. une promo programmée (`startsAt` futur) n'était jamais notifiée : le
 *     trigger sortait sans rien faire et aucun cron ne la reprenait ;
 *  2. modifier uniquement `startsAt` ne relançait pas la décision ;
 *  3. la fenêtre de dates était comparée à la date UTC alors que
 *     `startsAt`/`endsAt` sont des dates LOCALES : entre minuit et 2 h du
 *     matin à Paris, une promo commençant « aujourd'hui » était considérée
 *     comme future.
 *
 * L'idempotence repose sur une SIGNATURE de l'offre plutôt que sur un
 * booléen : tant que le pourcentage et les dates ne bougent pas, l'email
 * n'est envoyé qu'une fois ; si le pro change son offre, elle redevient
 * notifiable.
 */

export interface PromoNotificationInput {
  percent?: number;
  /** Fenêtre d'activité, dates LOCALES au format YYYY-MM-DD (incluses). */
  startsAt?: string | null;
  endsAt?: string | null;
  /** Choix explicite du pro : sans lui, aucun email. */
  notifyLoyaltyClients?: boolean;
  /** Signature de la dernière offre pour laquelle un email est parti. Lue
   *  depuis le registre `providers/{id}/promoNotifications/{serviceId}` et
   *  non depuis la prestation : le formulaire du pro réécrit `discount` en
   *  entier, elle n'y survivrait pas. */
  notifiedSignature?: string | null;
}

/** Identifie une OFFRE. Deux promos de même signature sont la même offre. */
export function promoSignature(promo: PromoNotificationInput): string {
  return `${promo.percent ?? 0}|${promo.startsAt ?? ''}|${promo.endsAt ?? ''}`;
}

/** Date du jour au format YYYY-MM-DD dans le fuseau donné (Paris par
 *  défaut) — à comparer aux dates locales des promos, jamais `toISOString`
 *  qui renvoie la date UTC. */
export function localToday(now: Date = new Date(), timeZone = 'Europe/Paris'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** La promo est-elle active à cette date locale ? Bornes incluses. */
export function isPromoActiveOn(promo: PromoNotificationInput, today: string): boolean {
  if (!promo.percent) return false;
  if (promo.startsAt && promo.startsAt > today) return false;
  if (promo.endsAt && promo.endsAt < today) return false;
  return true;
}

export type PromoDecision =
  | { send: false; reason: 'no-promo' | 'not-requested' | 'not-active' | 'already-sent' }
  | { send: true; signature: string };

/**
 * Faut-il envoyer l'email pour cette promo aujourd'hui ?
 *
 * Volontairement indépendante du throttle par prestataire : celui-ci est une
 * protection de volume côté appelant, et il ne doit être consommé QUE si un
 * email part réellement.
 */
export function decidePromoNotification(
  promo: PromoNotificationInput | null | undefined,
  today: string,
): PromoDecision {
  if (!promo?.percent) return { send: false, reason: 'no-promo' };
  if (promo.notifyLoyaltyClients !== true) return { send: false, reason: 'not-requested' };
  if (!isPromoActiveOn(promo, today)) return { send: false, reason: 'not-active' };
  const signature = promoSignature(promo);
  if (promo.notifiedSignature === signature) return { send: false, reason: 'already-sent' };
  return { send: true, signature };
}
