/**
 * Fidélité — MIROIR unique côté functions de packages/shared/src/utils/loyalty.ts
 * et hasLoyaltyAccess (access.ts). Les functions n'importent pas les packages
 * workspace à l'exécution : ce module centralise la copie pour que la règle
 * ne vive qu'à UN endroit ici (utilisé par l'agrégateur de stats, les
 * notifications de jalons et les emails). Garder en phase avec shared.
 */

/** Lancement du système — aucune rétroactivité (décision produit 2026-07-20). */
export const LOYALTY_LAUNCH_AT = new Date('2026-07-20T00:00:00+02:00');

export interface LoyaltySettingsMirror {
  enabled?: boolean;
  threshold?: number;
  rewardType?: string;
  rewardValue?: number;
  excludedServiceIds?: string[];
}

/** Cette résa remplit-elle la carte ? (connectée + confirmée + post-lancement) */
export function countsTowardLoyalty(b: {
  status: string;
  clientId: string | null;
  createdAt: Date;
}): boolean {
  return (
    b.status === 'confirmed' &&
    !!b.clientId &&
    b.createdAt.getTime() >= LOYALTY_LAUNCH_AT.getTime()
  );
}

/** Réglages exploitables ? */
export function isLoyaltyConfigValidMirror(
  s: LoyaltySettingsMirror | null | undefined,
): s is Required<Pick<LoyaltySettingsMirror, 'threshold' | 'rewardType' | 'rewardValue'>> &
  LoyaltySettingsMirror {
  if (!s?.enabled) return false;
  if (!Number.isInteger(s.threshold) || (s.threshold as number) < 1) return false;
  if (s.rewardType === 'percent') return (s.rewardValue ?? 0) >= 1 && (s.rewardValue as number) <= 100;
  if (s.rewardType === 'amount') return Number.isInteger(s.rewardValue) && (s.rewardValue as number) >= 1;
  return false;
}

/** Gate d'accès du pro (plan payant actif, essai avec carte, ou comp actif). */
export function hasLoyaltyAccessMirror(p: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!p) return false;
  const ov = p.accessOverride as
    | { active?: boolean; until?: { toDate?: () => Date } | string | null }
    | undefined;
  if (ov?.active) {
    if (!ov.until) return true;
    const until =
      typeof (ov.until as { toDate?: () => Date }).toDate === 'function'
        ? (ov.until as { toDate: () => Date }).toDate()
        : new Date(ov.until as string);
    if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now()) return true;
  }
  const sub = (p.subscription ?? {}) as {
    status?: string;
    stripeSubscriptionId?: string | null;
    revenuecatAppUserId?: string | null;
  };
  if (sub.status === 'active') return true;
  return sub.status === 'trialing' && !!(sub.stripeSubscriptionId || sub.revenuecatAppUserId);
}

/** Libellé de la récompense (« −10 % » / « −5 € »), localisé. */
export function loyaltyRewardLabel(
  rewardType: string,
  rewardValue: number,
  locale: 'fr' | 'en',
): string {
  if (rewardType === 'percent') {
    return locale === 'en' ? `−${rewardValue}%` : `−${rewardValue} %`;
  }
  const euros = rewardValue / 100;
  const v = Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
  return locale === 'en' ? `−€${v}` : `−${v} €`;
}
