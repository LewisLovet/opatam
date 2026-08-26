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

/**
 * Ce que l'offre coûte au commercial — commission = % du MRR réellement
 * facturé pendant 12 mois. Renvoie la commission sur 12 mois SANS l'offre et
 * AVEC, en centimes, pour un abonnement au tarif catalogue donné.
 *
 * Hypothèses affichées comme telles dans l'UI : le client reste 12 mois, au
 * tarif catalogue. `once` = 1 facture réduite ; `repeating` = n factures
 * réduites ; une offre « annuel seulement » réduit la facture annuelle
 * (mensualisée sur 12 mois côté commission, l'effet est identique).
 */
export function commissionOffreSurDouzeMois(args: {
  mensuelCents: number;
  annuelCents: number;
  tauxPct: number;
  coupon: { percentOff: number; duration: 'once' | 'repeating' | 'forever'; durationInMonths?: number };
  annuelSeulement?: boolean;
}): { sansOffreCents: number; avecOffreCents: number } {
  const taux = args.tauxPct / 100;
  const pct = args.coupon.percentOff / 100;
  if (args.annuelSeulement) {
    // Une seule facture annuelle, réduite une fois.
    const base = args.annuelCents;
    return {
      sansOffreCents: Math.round(base * taux),
      avecOffreCents: Math.round(base * (1 - pct) * taux),
    };
  }
  const base = args.mensuelCents * 12;
  const moisReduits =
    args.coupon.duration === 'once'
      ? 1
      : args.coupon.duration === 'repeating'
        ? (args.coupon.durationInMonths ?? 1)
        : 12;
  const reduction = args.mensuelCents * pct * Math.min(12, moisReduits);
  return {
    sansOffreCents: Math.round(base * taux),
    avecOffreCents: Math.round((base - reduction) * taux),
  };
}
