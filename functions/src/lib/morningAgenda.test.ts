import { describe, it, expect } from 'vitest';
import { decideMorningAgenda, providerTimeZone, localTime } from './morningAgenda';

/** 22 août 2026, 08 h 00 à Paris (CEST, UTC+2) → 06 h 00 UTC. */
const huitHeuresParis = new Date('2026-08-22T06:00:00Z');
/** Même jour, 08 h 00 à Lisbonne (WEST, UTC+1) → 07 h 00 UTC. */
const huitHeuresLisbonne = new Date('2026-08-22T07:00:00Z');

const rdv = (iso: string) => new Date(iso);

describe('providerTimeZone — le pays, pas le champ semé', () => {
  it('France → Europe/Paris', () => expect(providerTimeZone('FR')).toBe('Europe/Paris'));
  it('Portugal → Europe/Lisbon', () => expect(providerTimeZone('PT')).toBe('Europe/Lisbon'));
  it('Allemagne → Europe/Berlin', () => expect(providerTimeZone('DE')).toBe('Europe/Berlin'));
  it('pays inconnu ou absent → Paris par défaut', () => {
    expect(providerTimeZone(null)).toBe('Europe/Paris');
    expect(providerTimeZone('XX')).toBe('Europe/Paris');
  });
});

describe('decideMorningAgenda — le Portugal ne reçoit plus à 7 h', () => {
  const rdvsDuJour = [rdv('2026-08-22T08:30:00Z'), rdv('2026-08-22T12:00:00Z')];

  it('Paris à 8 h locales → envoi', () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: true, lastSentOn: null, bookingTimes: rdvsDuJour,
    });
    expect(d.send).toBe(true);
    if (d.send) expect(d.count).toBe(2);
  });

  it("Lisbonne au MÊME instant (7 h locales) → PAS d'envoi", () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Lisbon', enabled: true, lastSentOn: null, bookingTimes: rdvsDuJour,
    });
    expect(d.send).toBe(false);
    if (!d.send) expect(d.reason).toBe('pas-l-heure');
  });

  it('Lisbonne une heure plus tard (8 h locales) → envoi', () => {
    const d = decideMorningAgenda({
      now: huitHeuresLisbonne, timeZone: 'Europe/Lisbon', enabled: true, lastSentOn: null, bookingTimes: rdvsDuJour,
    });
    expect(d.send).toBe(true);
  });

  it("l'heure annoncée est celle du prestataire, pas celle de Paris", () => {
    const premier = rdv('2026-08-22T08:30:00Z'); // 10 h 30 à Paris, 9 h 30 à Lisbonne
    const paris = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: true, lastSentOn: null, bookingTimes: [premier],
    });
    const lisbonne = decideMorningAgenda({
      now: huitHeuresLisbonne, timeZone: 'Europe/Lisbon', enabled: true, lastSentOn: null, bookingTimes: [premier],
    });
    if (paris.send) expect(paris.firstTime).toBe('10:30');
    if (lisbonne.send) expect(lisbonne.firstTime).toBe('09:30');
  });

  it('résumé désactivé → aucun envoi, et aucun marqueur', () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: false,
      lastSentOn: null, bookingTimes: rdvsDuJour,
    });
    expect(d.send).toBe(false);
    if (!d.send) expect(d.reason).toBe('desactive');
  });

  it('déjà envoyé aujourd’hui → pas de doublon', () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: true, lastSentOn: '2026-08-22', bookingTimes: rdvsDuJour,
    });
    expect(d.send).toBe(false);
    if (!d.send) expect(d.reason).toBe('deja-envoye');
  });

  it('envoyé la veille → nouvel envoi', () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: true, lastSentOn: '2026-08-21', bookingTimes: rdvsDuJour,
    });
    expect(d.send).toBe(true);
  });

  it('aucun rendez-vous aujourd’hui → silence', () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: true, lastSentOn: null,
      bookingTimes: [rdv('2026-08-23T09:00:00Z')], // demain
    });
    expect(d.send).toBe(false);
    if (!d.send) expect(d.reason).toBe('aucun-rdv');
  });

  it("un rendez-vous à 00 h 30 à Lisbonne appartient à SA journée, pas à la veille parisienne", () => {
    // 2026-08-22 23:30 UTC = 00 h 30 le 23 à Lisbonne, et 01 h 30 le 23 à Paris.
    const tardif = rdv('2026-08-22T23:30:00Z');
    const huitLisbonne23 = new Date('2026-08-23T07:00:00Z');
    const d = decideMorningAgenda({
      now: huitLisbonne23, timeZone: 'Europe/Lisbon', enabled: true, lastSentOn: null, bookingTimes: [tardif],
    });
    expect(d.send).toBe(true);
    if (d.send) expect(d.today).toBe('2026-08-23');
  });

  it('le premier rendez-vous est bien le plus tôt, quel que soit l’ordre reçu', () => {
    const d = decideMorningAgenda({
      now: huitHeuresParis, timeZone: 'Europe/Paris', enabled: true, lastSentOn: null,
      bookingTimes: [rdv('2026-08-22T15:00:00Z'), rdv('2026-08-22T07:15:00Z')],
    });
    if (d.send) expect(d.firstTime).toBe(localTime(rdv('2026-08-22T07:15:00Z'), 'Europe/Paris'));
  });
});
