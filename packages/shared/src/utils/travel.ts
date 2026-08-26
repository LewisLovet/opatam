/**
 * Frais de déplacement — logique pure des paliers.
 *
 * Un lieu `mobile` peut porter une `travelZone` : une liste ordonnée de
 * paliers `{ maxKm, fee }`. La borne du DERNIER palier est la limite de la
 * zone : au-delà, la réservation est refusée (blocage net, décision produit).
 * Un palier à `fee: 0` exprime « déplacement offert jusqu'à X km ».
 *
 * La distance est ROUTIÈRE (Mapbox Directions, appelé côté serveur
 * uniquement). Le haversine ne sert jamais à tarifer : seulement de
 * pré-filtre certain (haversine ≤ routier, donc haversine > limite ⇒ hors
 * zone sans appel API).
 *
 * Le frais est un montant SÉPARÉ de booking.price : l'acompte, les promos
 * et la fidélité se calculent sur les prestations seules.
 *   total dû      = price + travel.fee
 *   reste à payer = price + travel.fee − acompte
 */

import type { TravelZoneTier } from '../types';

export const MAX_TRAVEL_TIERS = 8;
/** Borne haute autorisée pour un palier (km). */
export const MAX_TRAVEL_TIER_KM = 300;
/** Frais maximal par palier (centimes) : 500 €. */
export const MAX_TRAVEL_TIER_FEE = 50_000;

/**
 * Résout le palier applicable pour une distance routière donnée.
 * Borne INCLUSE : une distance exactement égale à `maxKm` appartient au
 * palier. Retourne `null` si la distance dépasse le dernier palier (hors
 * zone) ou si la liste est vide.
 */
export function resolveTravelTier(
  tiers: TravelZoneTier[],
  distanceKm: number,
): TravelZoneTier | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  for (const tier of tiers) {
    if (distanceKm <= tier.maxKm) return tier;
  }
  return null;
}

/** Limite de la zone (km) — la borne du dernier palier ; null si zone vide. */
export function travelZoneLimitKm(tiers: TravelZoneTier[] | null | undefined): number | null {
  if (!tiers || tiers.length === 0) return null;
  return tiers[tiers.length - 1].maxKm;
}

/**
 * Arrondit une coordonnée à `decimals` décimales. Sert de clé de cache
 * (4 décimales ≈ 11 m : deux saisies de la même adresse tombent sur la
 * même entrée).
 */
export function roundCoordinate(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * La liste de paliers est-elle structurellement valide ?
 * (Miroir pur du schéma zod, utilisable dans les formulaires mobiles.)
 */
export function isValidTravelZone(tiers: TravelZoneTier[]): boolean {
  if (tiers.length === 0 || tiers.length > MAX_TRAVEL_TIERS) return false;
  let previousMax = 0;
  for (const tier of tiers) {
    if (!Number.isFinite(tier.maxKm) || tier.maxKm <= previousMax) return false;
    if (tier.maxKm > MAX_TRAVEL_TIER_KM) return false;
    if (!Number.isInteger(tier.fee) || tier.fee < 0 || tier.fee > MAX_TRAVEL_TIER_FEE) return false;
    previousMax = tier.maxKm;
  }
  return true;
}
