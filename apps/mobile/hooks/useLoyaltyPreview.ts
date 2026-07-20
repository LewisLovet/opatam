/**
 * useLoyaltyPreview — aperçu CLIENT de la réduction fidélité dans le tunnel.
 *
 * Quand la récompense du client est armée chez ce pro, la réduction doit se
 * voir sur le prix À CHAQUE ÉTAPE (prestations, date, confirmation), pas
 * seulement dans le toast final. Ce hook reproduit EXACTEMENT le calcul
 * serveur (mêmes helpers shared, même règle « première prestation éligible »,
 * même meilleure-des-deux face aux promos) — l'aperçu et le prix facturé ne
 * peuvent pas diverger.
 *
 * Affichage uniquement : le payload API reste intact, le serveur reste la
 * seule autorité (booking.service applique la réduction à la création).
 */

import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { WithId } from '@booking-app/firebase';
import type { Service, ServiceDiscount, ServiceSelections } from '@booking-app/shared';
import {
  computeDiscountedTotal,
  isLoyaltyConfigValid,
  hasLoyaltyAccess,
  isServiceLoyaltyEligible,
  applyLoyaltyToLine,
} from '@booking-app/shared';
import { useAuth } from '../contexts';
import { useLoyaltyCards, formatLoyaltyReward } from './useLoyaltyCards';

interface CartItemLike {
  service: WithId<Service>;
  selections: ServiceSelections;
}

interface ProviderLike {
  id: string;
  settings?: { loyalty?: import('@booking-app/shared').LoyaltySettings | null } | null;
  accessOverride?: unknown;
  subscription?: unknown;
}

export interface LoyaltyPreview {
  /** Réduction en centimes déjà applicable à ce panier (0 = rien à afficher). */
  amountOff: number;
  /** Libellé de la récompense (« −10 % » / « −5 € ») — null si inactif. */
  rewardLabel: string | null;
  /** Réglages fidélité quand la récompense du client est ARMÉE chez ce pro
   *  (gate + config valides) — indépendant du panier ; sert aux aperçus de
   *  prix hors panier (picker de prestation, footer). */
  armedSettings: import('@booking-app/shared').LoyaltySettings | null;
}

const NONE: LoyaltyPreview = { amountOff: 0, rewardLabel: null, armedSettings: null };

export function useLoyaltyPreview(
  provider: ProviderLike | null | undefined,
  cart: CartItemLike[],
  globalDiscount: ServiceDiscount | null | undefined,
  t: TFunction,
): LoyaltyPreview {
  const { isAuthenticated } = useAuth();
  const { cards } = useLoyaltyCards(isAuthenticated);

  return useMemo(() => {
    if (!provider) return NONE;
    const settings = provider.settings?.loyalty ?? null;
    if (
      !isLoyaltyConfigValid(settings) ||
      !hasLoyaltyAccess(provider as Parameters<typeof hasLoyaltyAccess>[0])
    ) {
      return NONE;
    }
    const card = cards.find((c) => c.providerId === provider.id);
    if (!card?.armed) return NONE;

    // Armée : disponible même panier vide (aperçus hors panier).
    const base = { ...NONE, armedSettings: settings };

    // Même règle que le serveur : LA PREMIÈRE prestation éligible du panier.
    const target = cart.find((c) => isServiceLoyaltyEligible(c.service.id, settings));
    if (!target) return base;
    const eff = computeDiscountedTotal(target.service, target.selections, globalDiscount);
    const applied = applyLoyaltyToLine(eff.price, eff.original, settings);
    if (!applied) return base; // la promo en place fait déjà mieux

    return {
      amountOff: applied.amountOff,
      rewardLabel: formatLoyaltyReward(settings.rewardType, settings.rewardValue, t),
      armedSettings: settings,
    };
  }, [provider, cart, globalDiscount, cards, t]);
}
