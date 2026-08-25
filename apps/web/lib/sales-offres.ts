/**
 * Offres commerciales encadrées — le catalogue.
 *
 * Décisions direction (2026-08-26) : quatre offres, codes à usage unique
 * valables 14 jours, génération libre par les commerciaux mais TOUT est
 * tracé (`salesOffers/{code}` porte le commercial, le prospect visé et
 * l'offre). L'admin peut désactiver une offre (doc `salesConfig/offres`).
 *
 * Mécanique : chaque code généré est un VRAI Promotion Code Stripe
 * (max_redemptions 1, expires_at +14 j) adossé à un coupon par offre —
 * le chemin de paiement existant sait déjà les appliquer, on ne touche
 * pas au checkout. Stripe fait respecter l'usage unique et l'expiration.
 */

export interface OffreCommerciale {
  id: string;
  label: string;
  /** Ce que le commercial dit au prospect. */
  pitch: string;
  /** Paramètres du coupon Stripe (créé paresseusement, id déterministe). */
  coupon: {
    percentOff: number;
    duration: 'once' | 'repeating';
    durationInMonths?: number;
  };
  /** Pensée pour l'abonnement annuel — indication commerciale : Stripe ne
   *  sait pas restreindre un coupon à un prix précis, un usage sur le
   *  mensuel donnerait une remise dérisoire (−10 % d'un seul mois). */
  annuelSeulement?: boolean;
}

export const OFFRES_VALIDITE_JOURS = 14;

export const OFFRES_CATALOGUE: OffreCommerciale[] = [
  {
    id: 'moitie-premier-mois',
    label: '−50 % le premier mois',
    pitch: 'Le premier mois à moitié prix — 9,95 € au lieu de 19,90 € sur Pro.',
    coupon: { percentOff: 50, duration: 'once' },
  },
  {
    id: 'mois-gratuit',
    label: '1 mois gratuit',
    pitch: 'Le premier mois offert, en plus des 30 jours d’essai.',
    coupon: { percentOff: 100, duration: 'once' },
  },
  {
    id: 'vingt-pct-trois-mois',
    label: '−20 % pendant 3 mois',
    pitch: 'Trois mois à −20 % — 15,92 € au lieu de 19,90 € sur Pro.',
    coupon: { percentOff: 20, duration: 'repeating', durationInMonths: 3 },
  },
  {
    id: 'dix-pct-annuel',
    label: '−10 % supplémentaires sur l’annuel',
    pitch: 'L’abonnement annuel (déjà 2 mois offerts) avec 10 % de plus — 179,10 € au lieu de 199 € sur Pro.',
    coupon: { percentOff: 10, duration: 'once' },
    annuelSeulement: true,
  },
];

/** Id Stripe DÉTERMINISTE du coupon d'une offre — créé une fois, réutilisé. */
export function couponIdPourOffre(offreId: string): string {
  return `sales-offre-${offreId}`;
}

export function offreParId(id: string): OffreCommerciale | null {
  return OFFRES_CATALOGUE.find((o) => o.id === id) ?? null;
}
