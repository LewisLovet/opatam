/**
 * useLoyaltyCards Hook
 *
 * Cartes de fidélité du client connecté, via GET /api/loyalty/me (auth
 * Bearer idToken Firebase). Le payload est SANITISÉ côté serveur : jamais
 * de notes privées du pro, uniquement la progression et la récompense.
 *
 * NOTE : import direct (`../../hooks/useLoyaltyCards`) plutôt que via
 * hooks/index.ts pour éviter les conflits avec les chantiers parallèles.
 */

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import { useAuth } from '../contexts';
import { API_URL } from '../lib/config';

/** Une carte, telle que renvoyée par GET /api/loyalty/me. */
export interface LoyaltyCard {
  providerId: string;
  businessName: string;
  slug: string | null;
  photoURL: string | null;
  confirmedCount: number;
  threshold: number;
  rewardType: 'percent' | 'amount';
  rewardValue: number;
  /** RDV honorés restants avant récompense (0 = armée). */
  remaining: number;
  /** true = la prochaine réservation est réduite. */
  armed: boolean;
}

export interface UseLoyaltyCardsResult {
  cards: LoyaltyCard[];
  loading: boolean;
  /** true = le fetch a échoué (réseau/serveur). */
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * `enabled = false` court-circuite tout (aucun fetch) — utile sur la page
 * prestataire où la ligne fidélité est silencieuse pour les non-connectés.
 */
export function useLoyaltyCards(enabled = true): UseLoyaltyCardsResult {
  const { user } = useAuth();
  const active = enabled && !!user;

  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token = await user.getIdToken();
      // Timeout dur : un serveur injoignable (IP LAN périmée, coupure) ne
      // doit JAMAIS laisser l'écran en chargement infini.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${API_URL}/api/loyalty/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCards(Array.isArray(data.cards) ? (data.cards as LoyaltyCard[]) : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!active) {
      setCards([]);
      setLoading(false);
      setError(false);
      return;
    }
    void refresh();
  }, [active, refresh]);

  return { cards, loading, error, refresh };
}

/**
 * Libellé de la récompense — « −10 % » ou « −5 € » — traduit via les clés
 * loyalty.reward.* (les montants sont stockés en centimes).
 */
export function formatLoyaltyReward(
  rewardType: 'percent' | 'amount',
  rewardValue: number,
  t: TFunction,
): string {
  if (rewardType === 'percent') {
    return t('loyalty.reward.percent', { value: rewardValue });
  }
  const euros = rewardValue / 100;
  const value = Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
  return t('loyalty.reward.amount', { value });
}
