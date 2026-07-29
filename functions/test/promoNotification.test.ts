import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  decidePromoNotification,
  isPromoActiveOn,
  localToday,
  promoPreCheck,
  promoSignature,
  resolveTimeZone,
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


describe('resolveTimeZone', () => {
  it('accepte un fuseau IANA valide', () => {
    expect(resolveTimeZone('Europe/Lisbon')).toBe('Europe/Lisbon');
    expect(resolveTimeZone('America/Guadeloupe')).toBe('America/Guadeloupe');
  });

  it('retombe sur Paris quand le prestataire n\'en déclare pas', () => {
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone('')).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone('   ')).toBe(DEFAULT_TIME_ZONE);
  });

  it('retombe sur Paris sur un fuseau invalide, SANS lever', () => {
    // Une faute de frappe en base ne doit pas faire échouer l'envoi.
    expect(() => resolveTimeZone('Europe/Lisboa')).not.toThrow();
    expect(resolveTimeZone('Europe/Lisboa')).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(42)).toBe(DEFAULT_TIME_ZONE);
  });
});

describe('fuseau du prestataire — Portugal', () => {
  // Lisbonne est une heure DERRIÈRE Paris toute l'année.
  it('minuit à Lisbonne : le jour a changé là-bas, pas encore la veille à Paris', () => {
    // 23 h 30 UTC en été = 00 h 30 à Lisbonne (UTC+1) et 01 h 30 à Paris.
    const instant = new Date('2026-07-14T23:30:00Z');
    expect(localToday(instant, 'Europe/Lisbon')).toBe('2026-07-15');
    expect(localToday(instant, 'Europe/Paris')).toBe('2026-07-15');
  });

  it('une promo qui commence le 15 est active dès minuit à Lisbonne', () => {
    // 23 h 05 UTC le 14 juillet = 00 h 05 le 15 à Lisbonne.
    const instant = new Date('2026-07-14T23:05:00Z');
    const promo = { percent: 20, notifyLoyaltyClients: true, startsAt: '2026-07-15' };
    expect(decidePromoNotification(promo, localToday(instant, 'Europe/Lisbon')).send).toBe(true);
  });

  it('à 23 h 05 à Lisbonne la veille, elle ne l\'est pas encore', () => {
    // 22 h 05 UTC = 23 h 05 à Lisbonne, toujours le 14.
    const instant = new Date('2026-07-14T22:05:00Z');
    const promo = { percent: 20, notifyLoyaltyClients: true, startsAt: '2026-07-15' };
    const d = decidePromoNotification(promo, localToday(instant, 'Europe/Lisbon'));
    expect(d).toEqual({ send: false, reason: 'not-active' });
    // Et c'est bien le fuseau qui décide : à Paris il est déjà le 15.
    expect(decidePromoNotification(promo, localToday(instant, 'Europe/Paris')).send).toBe(true);
  });

  it('une promo qui expire le 14 est morte dès minuit à Lisbonne', () => {
    const instant = new Date('2026-07-14T23:05:00Z'); // 00 h 05 le 15 à Lisbonne
    const promo = { percent: 20, notifyLoyaltyClients: true, endsAt: '2026-07-14' };
    expect(decidePromoNotification(promo, localToday(instant, 'Europe/Lisbon'))).toEqual({
      send: false,
      reason: 'not-active',
    });
  });

  it('heure d\'HIVER : Lisbonne est à UTC, Paris à UTC+1', () => {
    // 23 h 30 UTC le 14 janvier : encore le 14 à Lisbonne, déjà le 15 à Paris.
    const instant = new Date('2026-01-14T23:30:00Z');
    expect(localToday(instant, 'Europe/Lisbon')).toBe('2026-01-14');
    expect(localToday(instant, 'Europe/Paris')).toBe('2026-01-15');

    const promo = { percent: 20, notifyLoyaltyClients: true, startsAt: '2026-01-15' };
    expect(decidePromoNotification(promo, localToday(instant, 'Europe/Lisbon')).send).toBe(false);
    expect(decidePromoNotification(promo, localToday(instant, 'Europe/Paris')).send).toBe(true);
  });

  it('un prestataire sans fuseau se comporte exactement comme avant', () => {
    const instant = new Date('2026-07-14T22:30:00Z');
    expect(localToday(instant, resolveTimeZone(undefined))).toBe(
      localToday(instant, 'Europe/Paris'),
    );
  });
});

describe('promoPreCheck', () => {
  it('écarte sans date ce qui ne dépend pas du fuseau', () => {
    expect(promoPreCheck(null)).toEqual({ send: false, reason: 'no-promo' });
    expect(promoPreCheck({ percent: 0, notifyLoyaltyClients: true })).toEqual({
      send: false,
      reason: 'no-promo',
    });
    expect(promoPreCheck({ percent: 20, notifyLoyaltyClients: false })).toEqual({
      send: false,
      reason: 'not-requested',
    });
  });

  it('laisse passer une offre à évaluer (le fuseau devient nécessaire)', () => {
    expect(promoPreCheck({ percent: 20, notifyLoyaltyClients: true })).toBeNull();
  });
});
