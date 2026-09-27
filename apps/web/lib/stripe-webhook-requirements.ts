/**
 * Événements Stripe que la production DOIT recevoir, et l'évaluation d'un
 * jeu de points de terminaison contre cette liste.
 *
 * Module PUR, sans import : il est chargé par le lanceur de tests de node
 * (`node --experimental-strip-types`) pour garantir qu'un contrôle qui
 * oublie un événement passe au ROUGE. C'est arrivé : `payment_intent.succeeded`
 * manquait à la liste Connect alors que c'est l'événement qui confirme
 * chaque acompte payé depuis l'application — le contrôle annonçait une
 * configuration correcte avec, potentiellement, aucune confirmation mobile.
 */

/** Flux PLATEFORME : abonnements, comptes connectés. */
export const REQUIRED_PLATFORM_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'account.updated',
  'account.application.deauthorized',
] as const;

/**
 * Flux CONNECT : tout ce qui touche un acompte. Les paiements sont DIRECTS
 * sur le compte du prestataire (web ET mobile depuis le 2026-09-27), donc
 * leurs événements arrivent par ce flux-là, jamais par la plateforme.
 */
export const REQUIRED_CONNECT_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  // Confirmation d'un acompte payé depuis l'APPLICATION (PaymentSheet).
  // Sans lui, une réservation mobile reste « en attente de paiement »
  // jusqu'au cron de rattrapage.
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
] as const;

export interface EndpointLike {
  status?: string | null;
  enabled_events: readonly string[];
}

export interface EventsCheck {
  ok: boolean;
  /** Événements requis absents de TOUS les points actifs. */
  missing: string[];
  /** Un point actif avec « * » couvre tout. */
  wildcard: boolean;
  activeCount: number;
}

/**
 * Un événement est couvert dès qu'UN point de terminaison ACTIF l'a. Un point
 * désactivé ne compte pas : Stripe ne lui livre rien.
 */
export function evaluateEvents(
  endpoints: readonly EndpointLike[],
  required: readonly string[],
): EventsCheck {
  const actifs = endpoints.filter((e) => (e.status ?? 'enabled') === 'enabled');
  const wildcard = actifs.some((e) => e.enabled_events.includes('*'));
  const present = new Set<string>();
  for (const e of actifs) for (const ev of e.enabled_events) present.add(ev);
  const missing = wildcard ? [] : required.filter((ev) => !present.has(ev));
  return { ok: actifs.length > 0 && missing.length === 0, missing, wildcard, activeCount: actifs.length };
}
