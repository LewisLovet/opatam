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

/** Fuseau de repli quand le prestataire n'en déclare pas, ou en déclare un
 *  que la plateforme ne connaît pas. */
export const DEFAULT_TIME_ZONE = 'Europe/Paris';

/**
 * Valide un identifiant IANA en le soumettant à `Intl.DateTimeFormat`,
 * seule autorité disponible ici. Un fuseau absent, mal orthographié ou
 * inconnu de la plateforme retombe sur Paris plutôt que de faire échouer
 * l'envoi — une promo mal datée d'une heure vaut mieux qu'une promo
 * jamais partie.
 */
export function resolveTimeZone(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: raw });
    return raw;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Date du jour au format YYYY-MM-DD dans le fuseau donné (Paris par
 *  défaut) — à comparer aux dates locales des promos, jamais `toISOString`
 *  qui renvoie la date UTC. */
export function localToday(now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string {
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
 * Les deux refus qui ne dépendent PAS d'une date, donc évaluables avant
 * d'avoir lu le prestataire.
 *
 * Le trigger se déclenche à CHAQUE écriture sur une prestation — changer
 * un libellé ou un prix suffit. Trancher ces cas d'abord évite une
 * lecture de prestataire sur l'écrasante majorité des écritures, alors
 * même qu'il faut désormais ce document pour connaître le fuseau.
 */
export function promoPreCheck(
  promo: PromoNotificationInput | null | undefined,
): { send: false; reason: 'no-promo' | 'not-requested' } | null {
  if (!promo?.percent) return { send: false, reason: 'no-promo' };
  if (promo.notifyLoyaltyClients !== true) return { send: false, reason: 'not-requested' };
  return null;
}

/**
 * Faut-il envoyer l'email pour cette promo aujourd'hui ?
 *
 * `today` est la date locale DU PRESTATAIRE : `startsAt` et `endsAt` sont
 * saisis dans son fuseau, les comparer à autre chose décale les bornes
 * autour de minuit.
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
