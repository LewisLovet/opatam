import type { LoyaltySettings } from '../types';

/**
 * Carte de fidélité — logique pure, partagée par le serveur (application de
 * la réduction à la création de résa), l'API « espace fidélité » client et
 * les UIs pro/client (progression).
 *
 * Modèle : tous les `threshold` RDV honorés chez un prestataire
 * (ProviderClient.confirmedCount), la PREMIÈRE prestation éligible de la
 * réservation suivante est réduite. Aucun état supplémentaire : tout se
 * déduit du compteur au moment de réserver. Une annulation ne « brûle »
 * jamais la récompense (le compteur n'a pas bougé).
 */

/**
 * Date de lancement du système de fidélité — AUCUNE rétroactivité :
 * seules les résas créées APRÈS cette date remplissent les cartes
 * (décision produit 2026-07-20). Les invités ne cumulent pas : seules
 * les résas faites CONNECTÉ (clientId présent) comptent — à
 * l'inscription, un trigger crédite uniquement la résa qui a mené à
 * l'inscription (la plus récente), pas le reste de l'historique.
 *
 * ⚠️ Dupliquée dans functions/src/lib/providerStatsAgg.ts (le miroir
 * functions n'importe pas les packages workspace) — garder en phase.
 */
export const LOYALTY_LAUNCH_AT = new Date('2026-07-20T00:00:00+02:00');

/**
 * Cette résa remplit-elle la carte ? Quatre conditions (décision produit
 * 2026-07-21) : confirmée, faite CONNECTÉ, créée après le lancement, et
 * dont le rendez-vous est PASSÉ — le tampon se gagne en honorant le RDV,
 * pas en le réservant.
 */
export function countsTowardLoyalty(
  b: {
    status: string;
    clientId: string | null;
    createdAt: Date;
    datetime: Date;
  },
  now: Date = new Date(),
): boolean {
  return (
    b.status === 'confirmed' &&
    !!b.clientId &&
    b.createdAt.getTime() >= LOYALTY_LAUNCH_AT.getTime() &&
    b.datetime.getTime() <= now.getTime()
  );
}

/** Réglages exploitables ? (garde-fou contre des docs partiels/legacy) */
export function isLoyaltyConfigValid(s: LoyaltySettings | null | undefined): s is LoyaltySettings {
  if (!s || !s.enabled) return false;
  if (!Number.isInteger(s.threshold) || s.threshold < 1) return false;
  if (s.rewardType === 'percent') return s.rewardValue >= 1 && s.rewardValue <= 100;
  if (s.rewardType === 'amount') return Number.isInteger(s.rewardValue) && s.rewardValue >= 1;
  return false;
}

/**
 * La récompense est-elle armée pour ce client ?
 * Vrai quand le compteur de RDV honorés atteint un multiple du seuil
 * (5, 10, 15… pour un seuil de 5) : la prochaine résa est réduite.
 */
export function isLoyaltyRewardArmed(confirmedCount: number, threshold: number): boolean {
  return (
    Number.isInteger(threshold) &&
    threshold >= 1 &&
    confirmedCount >= threshold &&
    confirmedCount % threshold === 0
  );
}

/** RDV honorés restants avant la prochaine récompense (0 = armée). */
export function loyaltyRemaining(confirmedCount: number, threshold: number): number {
  if (!Number.isInteger(threshold) || threshold < 1) return threshold;
  if (isLoyaltyRewardArmed(confirmedCount, threshold)) return 0;
  return threshold - (confirmedCount % threshold);
}

/**
 * Applique la récompense à UNE ligne de prestation.
 *
 * `linePrice` = prix effectif actuel de la ligne (promo déjà appliquée le cas
 * échéant) ; `lineOriginal` = prix avant promo. La fidélité se calcule sur le
 * prix AVANT promo, puis on garde LA MEILLEURE des deux réductions — jamais le
 * cumul (règle produit : pas de prix cassés involontaires).
 *
 * Retourne null quand la fidélité ne bat pas la promo en place (la ligne
 * reste telle quelle, pas de badge fidélité).
 */
export function applyLoyaltyToLine(
  linePrice: number,
  lineOriginal: number,
  settings: LoyaltySettings,
): { price: number; amountOff: number } | null {
  const reduction =
    settings.rewardType === 'percent'
      ? Math.round((lineOriginal * settings.rewardValue) / 100)
      : Math.min(settings.rewardValue, lineOriginal);
  const candidate = Math.max(0, lineOriginal - reduction);
  if (candidate >= linePrice) return null; // la promo existante fait déjà mieux
  return { price: candidate, amountOff: linePrice - candidate };
}

/** La prestation est-elle éligible ? (modèle opt-out, comme les promos) */
export function isServiceLoyaltyEligible(
  serviceId: string,
  settings: LoyaltySettings,
): boolean {
  return !(settings.excludedServiceIds ?? []).includes(serviceId);
}
