import { describe, it, expect } from 'vitest';
import {
  hasDepositAccess,
  isBaseTrialActive,
  isAccessOverrideActive,
} from './access';

const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);
const past = new Date(Date.now() - 24 * 3600 * 1000);
/** Firestore Timestamp-like (what the client SDK returns). */
const ts = (d: Date) => ({ toDate: () => d });

describe('isBaseTrialActive', () => {
  it('is active while trialing with a future validUntil (Date)', () => {
    expect(isBaseTrialActive({ status: 'trialing', validUntil: future })).toBe(true);
  });

  it('accepts a Firestore Timestamp validUntil', () => {
    expect(isBaseTrialActive({ status: 'trialing', validUntil: ts(future) })).toBe(true);
  });

  it('accepts an ISO string validUntil (serialized API payloads)', () => {
    expect(
      isBaseTrialActive({ status: 'trialing', validUntil: future.toISOString() }),
    ).toBe(true);
  });

  it('drops as soon as the trial expires — even with status still trialing', () => {
    // The base trial is local-only (no Stripe sub): it expires SILENTLY,
    // no webhook ever rewrites the status. Computing at read time is the fix.
    expect(isBaseTrialActive({ status: 'trialing', validUntil: past })).toBe(false);
  });

  it('is inactive without a validUntil', () => {
    expect(isBaseTrialActive({ status: 'trialing' })).toBe(false);
  });

  it('is inactive for any non-trialing status', () => {
    expect(isBaseTrialActive({ status: 'active', validUntil: future })).toBe(false);
    expect(isBaseTrialActive({ status: 'cancelled', validUntil: future })).toBe(false);
  });

  it('is inactive for null/undefined subscription', () => {
    expect(isBaseTrialActive(null)).toBe(false);
    expect(isBaseTrialActive(undefined)).toBe(false);
  });
});

describe('hasDepositAccess', () => {
  it('grants access during an active trial without the add-on', () => {
    expect(
      hasDepositAccess({
        depositsAddonActive: false,
        subscription: { status: 'trialing', validUntil: future },
      }),
    ).toBe(true);
  });

  it('grants access with the paid add-on (any base status)', () => {
    expect(
      hasDepositAccess({
        depositsAddonActive: true,
        subscription: { status: 'cancelled' },
      }),
    ).toBe(true);
  });

  it('denies an active paid base plan WITHOUT the add-on', () => {
    // The whole business model: base plan alone never includes deposits.
    expect(
      hasDepositAccess({
        depositsAddonActive: false,
        subscription: { status: 'active', validUntil: future },
      }),
    ).toBe(false);
  });

  it('denies once the trial expired without subscribing', () => {
    expect(
      hasDepositAccess({
        depositsAddonActive: false,
        subscription: { status: 'trialing', validUntil: past },
      }),
    ).toBe(false);
  });

  it('denies for a null provider', () => {
    expect(hasDepositAccess(null)).toBe(false);
    expect(hasDepositAccess(undefined)).toBe(false);
  });
});

describe('isAccessOverrideActive (régression après refactor toDate)', () => {
  it('active grant without end date = indefinite', () => {
    expect(isAccessOverrideActive({ active: true, until: null } as never)).toBe(true);
  });

  it('active grant with future end date', () => {
    expect(isAccessOverrideActive({ active: true, until: future } as never)).toBe(true);
  });

  it('expired grant', () => {
    expect(isAccessOverrideActive({ active: true, until: past } as never)).toBe(false);
  });

  it('inactive grant', () => {
    expect(isAccessOverrideActive({ active: false, until: future } as never)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeEntitlements — la matrice des accès offerts
// ─────────────────────────────────────────────────────────────────────────────
import { computeEntitlements, isTeamTier, canSystemUnpublish, isPubliclyVisible, filterPubliclyEntitled } from './access';

const paidSolo = { status: 'active', plan: 'solo', stripeSubscriptionId: 'sub_x' };
const rcTeam = { status: 'active', plan: 'team', revenuecatAppUserId: 'rc_x' };
const expiredLocalTrial = { status: 'trialing', plan: 'trial', validUntil: past };

describe('computeEntitlements — matrice comp', () => {
  it('1. comp actif sans date → droits complets, plan du comp', () => {
    const e = computeEntitlements({
      accessOverride: { active: true, plan: 'team', until: null } as never,
      subscription: expiredLocalTrial,
    });
    expect(e.source).toBe('comp');
    expect(e.effectivePlan).toBe('team');
    expect(e.canAccessPro).toBe(true);
    expect(e.canPublish).toBe(true);
    expect(e.paidUnderneath).toBe(false);
  });

  it('2. comp temporaire encore actif → droits ouverts, échéance exposée', () => {
    const e = computeEntitlements({
      accessOverride: { active: true, plan: 'solo', until: future } as never,
      subscription: expiredLocalTrial,
    });
    expect(e.canAccessPro).toBe(true);
    expect(e.effectivePlan).toBe('solo');
    expect(e.compExpiresAt?.getTime()).toBe(future.getTime());
  });

  it('3. comp expiré sans abonnement valide → plus AUCUN droit', () => {
    const e = computeEntitlements({
      accessOverride: { active: true, plan: 'team', until: past } as never,
      subscription: expiredLocalTrial,
    });
    expect(e.source).toBe('none');
    expect(e.effectivePlan).toBe(null);
    expect(e.canAccessPro).toBe(false);
    expect(e.canUseDeposits).toBe(false);
  });

  it('4. comp révoqué (null) sans abonnement valide → plus aucun droit', () => {
    const e = computeEntitlements({ accessOverride: null, subscription: expiredLocalTrial });
    expect(e.source).toBe('none');
    expect(e.canAccessPro).toBe(false);
  });

  it('5. comp retiré avec abonnement Stripe actif → le payant reste', () => {
    const e = computeEntitlements({ accessOverride: null, subscription: paidSolo });
    expect(e.source).toBe('paid');
    expect(e.effectivePlan).toBe('solo');
    expect(e.paidUnderneath).toBe(true);
  });

  it('6. comp retiré avec abonnement RevenueCat actif → le payant reste', () => {
    const e = computeEntitlements({ accessOverride: null, subscription: rcTeam });
    expect(e.source).toBe('paid');
    expect(e.effectivePlan).toBe('team');
  });

  it("7. Sérénité offerte puis comp expiré → l'acompte tombe, même si le flag matérialisé traîne", () => {
    const e = computeEntitlements({
      accessOverride: { active: true, plan: 'solo', until: past, serenity: true } as never,
      subscription: expiredLocalTrial,
      depositsAddonActive: true, // empreinte de l'ancien octroi, jamais nettoyée
    });
    expect(e.canUseDeposits).toBe(false);
  });

  it('7bis. Sérénité PAYÉE : le retrait du comp ne la coupe pas', () => {
    const e = computeEntitlements({
      accessOverride: { active: true, plan: 'solo', until: past, serenity: true } as never,
      subscription: paidSolo,
      serenity: { status: 'active' },
      depositsAddonActive: true,
    });
    expect(e.canUseDeposits).toBe(true);
  });

  it('comp solo sur payant team : le comp ne rétrograde pas le payant', () => {
    const e = computeEntitlements({
      accessOverride: { active: true, plan: 'solo', until: null } as never,
      subscription: rcTeam,
    });
    expect(e.effectivePlan).toBe('team');
    expect(e.source).toBe('paid');
  });

  it("l'essai local actif donne le tier complet, sans carte", () => {
    const e = computeEntitlements({
      subscription: { status: 'trialing', plan: 'trial', validUntil: future },
    });
    expect(e.source).toBe('trial');
    expect(e.effectivePlan).toBe('team');
    expect(isTeamTier({ subscription: { status: 'trialing', plan: 'trial', validUntil: future } })).toBe(true);
  });

  it('past_due garde les droits : Stripe réessaie encore', () => {
    const e = computeEntitlements({ subscription: { status: 'past_due', plan: 'solo' } });
    expect(e.canAccessPro).toBe(true);
    expect(e.paidUnderneath).toBe(true);
  });
});

describe('canSystemUnpublish — garde webhooks/crons (cas 8 et 9)', () => {
  it('8/9. expiration Stripe ou RevenueCat pendant un comp actif → PAS de dépublication', () => {
    expect(canSystemUnpublish({
      accessOverride: { active: true, plan: 'solo', until: null } as never,
      subscription: { status: 'cancelled', plan: 'solo' },
    })).toBe(false);
  });

  it('sans comp, la dépublication système reste permise', () => {
    expect(canSystemUnpublish({ subscription: { status: 'cancelled', plan: 'solo' } })).toBe(true);
    expect(canSystemUnpublish({
      accessOverride: { active: true, plan: 'solo', until: past } as never,
      subscription: { status: 'cancelled', plan: 'solo' },
    })).toBe(true);
  });
});

describe('isPubliclyVisible — la vitrine exige intention ET droits', () => {
  it("isPublished: true sans AUCUN droit → invisible sur toutes les surfaces publiques", () => {
    expect(isPubliclyVisible({ isPublished: true, subscription: expiredLocalTrial })).toBe(false);
  });
  it('isPublished: true + comp actif → visible', () => {
    expect(isPubliclyVisible({
      isPublished: true,
      accessOverride: { active: true, plan: 'solo', until: null } as never,
      subscription: expiredLocalTrial,
    })).toBe(true);
  });
  it('droits valides mais isPublished: false → invisible (le choix du pro prime)', () => {
    expect(isPubliclyVisible({ isPublished: false, subscription: paidSolo })).toBe(false);
  });
});

describe('filterPubliclyEntitled — les branches ville + texte de la recherche', () => {
  const expiredPublished = {
    businessName: 'Expiré', isPublished: true,
    cities: ['paris'], subscription: expiredLocalTrial,
  };
  const paidProvider = {
    businessName: 'Payant', isPublished: true,
    cities: ['paris'], subscription: paidSolo,
  };
  const trialProvider = {
    businessName: 'Essai', isPublished: true,
    cities: ['paris'], subscription: { status: 'trialing', plan: 'trial', validUntil: future },
  };
  const compProvider = {
    businessName: 'Comp', isPublished: true, cities: ['paris'],
    accessOverride: { active: true, plan: 'solo', until: null } as never,
    subscription: expiredLocalTrial,
  };

  it('recherche ville + texte : un expiré publié est exclu, les trois droits valides restent', () => {
    // Reproduit la branche searchProviders : droits d'abord, ville ensuite.
    const rows = [expiredPublished, paidProvider, trialProvider, compProvider];
    const out = filterPubliclyEntitled(rows).filter((p) => p.cities.includes('paris'));
    expect(out.length).toBe(3);
    expect(out.some((p) => p.businessName === 'Expiré')).toBe(false);
    expect(out.some((p) => p.businessName === 'Payant')).toBe(true);
    expect(out.some((p) => p.businessName === 'Essai')).toBe(true);
    expect(out.some((p) => p.businessName === 'Comp')).toBe(true);
  });

  it('recherche paginée ville + texte : même exclusion, pageSize et hasMore restent justes', () => {
    // Reproduit la branche searchProvidersPaginated : le filtre de droits
    // précède le slice — sinon la page se tronque avant l'exclusion.
    const pageSize = 2;
    const fetched = [expiredPublished, paidProvider, trialProvider, compProvider]; // page brute
    const filteredItems = filterPubliclyEntitled(fetched).filter((p) => p.cities.includes('paris'));
    const items = filteredItems.slice(0, pageSize);
    const hasMore = filteredItems.length > pageSize || false;
    expect(items.length).toBe(2);
    expect(items.some((p) => p.businessName === 'Expiré')).toBe(false);
    expect(hasMore).toBe(true); // 3 éligibles pour une page de 2
  });
});
