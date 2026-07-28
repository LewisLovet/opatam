import { describe, expect, it } from 'vitest';
import {
  buildLoyaltyCardIdentity,
  loyaltyRedemptionKey,
  type OwnedProviderClient,
} from './loyalty-identity';

/** Fiche `providerClients` minimale — seuls `ref.id` et `data` sont lus. */
function doc(
  id: string,
  data: Record<string, unknown>,
): OwnedProviderClient {
  return {
    ref: { id } as OwnedProviderClient['ref'],
    data: data as OwnedProviderClient['data'],
    clientKey: id.slice(id.indexOf('_') + 1),
  };
}

// Une fiche créée AVANT la v2 est activée d'office (grandfathering) : on
// date les fiches de test après, pour que seul `loyaltyActivatedAt` décide.
const APRES_V2 = new Date('2026-12-01T10:00:00Z');

describe('buildLoyaltyCardIdentity', () => {
  it('additionne les tampons de toutes les fiches du client', () => {
    const card = buildLoyaltyCardIdentity([
      doc('P_email:pro@x.com', { loyaltyConfirmedCount: 4, createdAt: APRES_V2 }),
      doc('P_email:perso@y.com', { loyaltyConfirmedCount: 2, createdAt: APRES_V2 }),
    ]);
    // Régression : le client voyait 4 d'un côté, 2 de l'autre, et n'atteignait
    // jamais le seuil de 6.
    expect(card.confirmedCount).toBe(6);
    expect(card.effectiveCount).toBe(6);
    expect(card.all).toHaveLength(2);
  });

  it("additionne aussi l'ajustement manuel, où que le pro l'ait posé", () => {
    const card = buildLoyaltyCardIdentity([
      doc('P_email:a@x.com', { loyaltyConfirmedCount: 3, createdAt: APRES_V2 }),
      doc('P_email:b@x.com', {
        loyaltyConfirmedCount: 0,
        loyaltyAdjustment: 2,
        createdAt: APRES_V2,
      }),
    ]);
    expect(card.adjustment).toBe(2);
    expect(card.effectiveCount).toBe(5);
  });

  it('ne descend jamais sous zéro avec un ajustement négatif', () => {
    const card = buildLoyaltyCardIdentity([
      doc('P_email:a@x.com', {
        loyaltyConfirmedCount: 1,
        loyaltyAdjustment: -5,
        createdAt: APRES_V2,
      }),
    ]);
    expect(card.effectiveCount).toBe(0);
  });

  it("la carte est activée dès qu'UNE fiche l'est", () => {
    const card = buildLoyaltyCardIdentity([
      doc('P_email:a@x.com', { loyaltyConfirmedCount: 5, createdAt: APRES_V2 }),
      doc('P_email:b@x.com', {
        loyaltyConfirmedCount: 0,
        loyaltyActivatedAt: new Date('2026-12-02T10:00:00Z'),
        createdAt: APRES_V2,
      }),
    ]);
    expect(card.activated).toBe(true);
  });

  it("la fiche activée devient la principale, même moins fournie", () => {
    // C'est elle qui porte l'écriture : sinon une nouvelle activation
    // partirait sur l'autre fiche et en créerait une deuxième.
    const card = buildLoyaltyCardIdentity([
      doc('P_email:grosse@x.com', { loyaltyConfirmedCount: 9, createdAt: APRES_V2 }),
      doc('P_email:activee@x.com', {
        loyaltyConfirmedCount: 1,
        loyaltyActivatedAt: new Date('2026-12-02T10:00:00Z'),
        createdAt: APRES_V2,
      }),
    ]);
    expect(card.primary?.ref.id).toBe('P_email:activee@x.com');
  });

  it('à défaut, la fiche la plus fournie', () => {
    const card = buildLoyaltyCardIdentity([
      doc('P_email:b@x.com', { loyaltyConfirmedCount: 1, createdAt: APRES_V2 }),
      doc('P_email:a@x.com', { loyaltyConfirmedCount: 7, createdAt: APRES_V2 }),
    ]);
    expect(card.primary?.ref.id).toBe('P_email:a@x.com');
  });

  it('à égalité, le choix est déterministe (deux appels concurrents visent la même fiche)', () => {
    const docs = [
      doc('P_email:b@x.com', { loyaltyConfirmedCount: 3, createdAt: APRES_V2 }),
      doc('P_email:a@x.com', { loyaltyConfirmedCount: 3, createdAt: APRES_V2 }),
    ];
    expect(buildLoyaltyCardIdentity(docs).primary?.ref.id).toBe('P_email:a@x.com');
    expect(buildLoyaltyCardIdentity([...docs].reverse()).primary?.ref.id).toBe(
      'P_email:a@x.com',
    );
  });

  it("l'opt-in promos est vrai dès qu'une fiche l'a coché", () => {
    const card = buildLoyaltyCardIdentity([
      doc('P_email:a@x.com', { createdAt: APRES_V2 }),
      doc('P_email:b@x.com', { promoEmailsOptIn: true, createdAt: APRES_V2 }),
    ]);
    expect(card.promoEmailsOptIn).toBe(true);
  });

  it('sans aucune fiche, carte vide et sans principale', () => {
    const card = buildLoyaltyCardIdentity([]);
    expect(card.primary).toBeNull();
    expect(card.effectiveCount).toBe(0);
    expect(card.activated).toBe(false);
  });
});

describe('loyaltyRedemptionKey', () => {
  it("dérive de l'UID, jamais d'un email", () => {
    expect(loyaltyRedemptionKey('abc123')).toBe('id:abc123');
  });
});
