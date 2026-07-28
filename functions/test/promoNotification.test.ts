import { describe, expect, it } from 'vitest';
import {
  decidePromoNotification,
  isPromoActiveOn,
  localToday,
  promoSignature,
} from '../src/lib/promoNotification';

const BASE = { percent: 20, notifyLoyaltyClients: true } as const;

describe('localToday', () => {
  it('renvoie la date LOCALE, pas la date UTC', () => {
    // 00 h 30 à Paris le 15 juillet = 22 h 30 UTC le 14 juillet. Sans fuseau,
    // une promo commençant le 15 aurait été jugée « future » pendant 2 h.
    const nuitParisienne = new Date('2026-07-14T22:30:00Z');
    expect(localToday(nuitParisienne)).toBe('2026-07-15');
    expect(nuitParisienne.toISOString().slice(0, 10)).toBe('2026-07-14');
  });

  it('gère aussi la période hivernale (UTC+1)', () => {
    expect(localToday(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
  });
});

describe('isPromoActiveOn', () => {
  it('bornes incluses', () => {
    const promo = { ...BASE, startsAt: '2026-07-10', endsAt: '2026-07-20' };
    expect(isPromoActiveOn(promo, '2026-07-10')).toBe(true);
    expect(isPromoActiveOn(promo, '2026-07-20')).toBe(true);
  });
  it('hors fenêtre', () => {
    const promo = { ...BASE, startsAt: '2026-07-10', endsAt: '2026-07-20' };
    expect(isPromoActiveOn(promo, '2026-07-09')).toBe(false);
    expect(isPromoActiveOn(promo, '2026-07-21')).toBe(false);
  });
  it('sans bornes = toujours active', () => {
    expect(isPromoActiveOn({ ...BASE }, '2030-01-01')).toBe(true);
  });
});

describe('decidePromoNotification', () => {
  it('refuse sans promo', () => {
    expect(decidePromoNotification(null, '2026-07-15')).toEqual({ send: false, reason: 'no-promo' });
  });

  it("refuse si le pro n'a pas demandé l'envoi", () => {
    const d = decidePromoNotification({ percent: 20, notifyLoyaltyClients: false }, '2026-07-15');
    expect(d).toEqual({ send: false, reason: 'not-requested' });
  });

  it('refuse une promo pas encore commencée', () => {
    const d = decidePromoNotification({ ...BASE, startsAt: '2026-08-01' }, '2026-07-15');
    expect(d).toEqual({ send: false, reason: 'not-active' });
  });

  it('ACCEPTE une promo programmée le jour où elle devient active (le cron la reprend)', () => {
    const promo = { ...BASE, startsAt: '2026-08-01' };
    expect(decidePromoNotification(promo, '2026-08-01')).toEqual({
      send: true,
      signature: promoSignature(promo),
    });
  });

  it("n'envoie qu'une fois pour la même offre", () => {
    const promo = { ...BASE, startsAt: '2026-07-01' };
    const first = decidePromoNotification(promo, '2026-07-15');
    expect(first.send).toBe(true);
    const after = { ...promo, notifiedSignature: promoSignature(promo) };
    expect(decidePromoNotification(after, '2026-07-16')).toEqual({
      send: false,
      reason: 'already-sent',
    });
  });

  it('renotifie si le pro change son pourcentage', () => {
    const promo = { ...BASE, percent: 20, notifiedSignature: promoSignature({ percent: 10 }) };
    expect(decidePromoNotification(promo, '2026-07-15').send).toBe(true);
  });

  it("renotifie si le pro avance la date de début à aujourd'hui", () => {
    // Cas régression : seule `startsAt` change. L'ancienne détection
    // (percent / endsAt uniquement) ne relançait rien.
    const programmee = { ...BASE, startsAt: '2026-09-01' };
    const avancee = {
      ...BASE,
      startsAt: '2026-07-15',
      notifiedSignature: promoSignature(programmee),
    };
    expect(decidePromoNotification(avancee, '2026-07-15').send).toBe(true);
  });

  it('refuse une promo expirée même jamais notifiée', () => {
    const d = decidePromoNotification({ ...BASE, endsAt: '2026-07-01' }, '2026-07-15');
    expect(d).toEqual({ send: false, reason: 'not-active' });
  });
});
