/**
 * Fuseaux côté Cloud Functions — e-mails et récapitulatif quotidien.
 *
 *   npx tsx --test functions/test/fuseaux.tsx.test.ts
 *
 * En `tsx` et non vitest : le lanceur vitest du dépôt est cassé (binding
 * @rolldown manquant) et ces deux contrats sont trop coûteux en bugs pour
 * rester sans test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatEmailDate, formatEmailTime } from '../src/utils/emailI18n';
import { providerTimeZone } from '../src/lib/morningAgenda';
import { estHeureSilencieuse, heureLocaleDe } from '../src/lib/heuresSilencieuses';
import { ajouterJours, jourLocal } from '../src/lib/fuseaux';
import { demainChezLeSalon, estDemainChezLeSalon, fenetreDeRechercheDemain } from '../src/lib/agendaDemain';

// 08:00 à La Réunion le 16 novembre 2026 = 04:00 UTC.
const RDV_REUNION = new Date('2026-11-16T04:00:00Z');

describe('les e-mails annoncent l’heure du SALON', () => {
  it('un rendez-vous réunionnais dit 08:00, pas 05:00', () => {
    // Sans fuseau, l'e-mail annonçait l'heure de Paris — trois heures avant
    // l'heure réelle en hiver métropolitain.
    assert.equal(formatEmailTime(RDV_REUNION, 'fr', 'Indian/Reunion'), '08:00');
    assert.equal(formatEmailTime(RDV_REUNION, 'fr'), '05:00');
  });

  it('la DATE aussi peut changer, pas seulement l’heure', () => {
    // 2026-11-16T22:30Z : lundi 23:30 à Paris, MARDI 02:30 à La Réunion.
    const tard = new Date('2026-11-16T22:30:00Z');
    assert.match(formatEmailDate(tard, 'fr', 'Indian/Reunion'), /mardi 17/);
    assert.match(formatEmailDate(tard, 'fr'), /lundi 16/);
  });

  it('sans fuseau, le comportement est INCHANGÉ (Paris)', () => {
    // Les réservations d'avant le chantier n'ont pas de fuseau figé : leurs
    // e-mails doivent rester exactement ce qu'ils étaient.
    assert.equal(formatEmailTime(RDV_REUNION, 'en'), formatEmailTime(RDV_REUNION, 'en', 'Europe/Paris'));
    assert.equal(formatEmailDate(RDV_REUNION, 'pt'), formatEmailDate(RDV_REUNION, 'pt', 'Europe/Paris'));
  });

  it('l’heure reste en 24 h dans toutes les langues', () => {
    for (const langue of ['fr', 'en', 'it', 'pt', 'de'] as const) {
      assert.match(formatEmailTime(RDV_REUNION, langue, 'Indian/Reunion'), /^08[:h]?00$/);
    }
  });
});

describe('le récapitulatif quotidien part à 8 h CHEZ LE PRO', () => {
  it('le fuseau du LIEU prime sur la table par pays', () => {
    // La Réunion est en « FR » : la table seule renvoyait Europe/Paris, et
    // le récapitulatif partait trois heures trop tôt.
    assert.equal(providerTimeZone('FR', 'Indian/Reunion'), 'Indian/Reunion');
    assert.equal(providerTimeZone('FR'), 'Europe/Paris');
  });

  it('la table reste le repli pour les lieux pas encore résolus', () => {
    assert.equal(providerTimeZone('PT', null), 'Europe/Lisbon');
    assert.equal(providerTimeZone('BE', undefined), 'Europe/Brussels');
    assert.equal(providerTimeZone('XX'), 'Europe/Paris');
  });

  it('un fuseau de lieu vide ne masque pas la table', () => {
    assert.equal(providerTimeZone('PT', ''), 'Europe/Lisbon');
  });
});

describe('les heures silencieuses se jugent CHEZ le destinataire', () => {
  // 2026-11-16T02:00:00Z : 3 h du matin à Paris, mais 6 h à La Réunion.
  const NUIT_A_PARIS = new Date('2026-11-16T02:00:00Z');

  it('LE BUG : le rappel de 6 h réunionnais ne partait jamais', () => {
    // Le cron s'arrêtait entièrement quand il faisait nuit à Paris. Un
    // rendez-vous à 8 h à La Réunion demande son rappel « 2 h avant » à
    // 6 h locales — 3 h du matin à Paris. Il ne partait pas en retard :
    // il ne partait JAMAIS.
    assert.equal(heureLocaleDe(NUIT_A_PARIS, 'Europe/Paris'), 3);
    assert.equal(heureLocaleDe(NUIT_A_PARIS, 'Indian/Reunion'), 6);

    assert.equal(estHeureSilencieuse(NUIT_A_PARIS, 'Europe/Paris'), true);
    assert.equal(estHeureSilencieuse(NUIT_A_PARIS, 'Indian/Reunion'), false);
  });

  it('les bornes sont 23 h et 6 h, chez le destinataire', () => {
    const a = (h: number) => new Date(`2026-11-16T${String(h).padStart(2, '0')}:30:00Z`);
    // En UTC pour lire les bornes sans détour.
    assert.equal(estHeureSilencieuse(a(22), 'UTC'), false, '22h30 : encore permis');
    assert.equal(estHeureSilencieuse(a(23), 'UTC'), true, '23h30 : silence');
    assert.equal(estHeureSilencieuse(a(5), 'UTC'), true, '5h30 : silence');
    assert.equal(estHeureSilencieuse(a(6), 'UTC'), false, '6h30 : on peut');
  });

  it('sans fuseau, comportement INCHANGÉ (Paris)', () => {
    assert.equal(
      estHeureSilencieuse(NUIT_A_PARIS, null),
      estHeureSilencieuse(NUIT_A_PARIS, 'Europe/Paris'),
    );
    assert.equal(estHeureSilencieuse(NUIT_A_PARIS, ''), true);
  });

  it('un fuseau invalide en base ne fait pas taire TOUS les rappels', () => {
    // Retomber sur Paris vaut mieux que lever et interrompre le cron pour
    // tout le monde à cause d'une seule fiche mal renseignée.
    assert.equal(estHeureSilencieuse(NUIT_A_PARIS, 'Pas/UnFuseau'), true);
  });

  it('New York : 2 h du matin à Paris, 20 h la veille sur place', () => {
    assert.equal(heureLocaleDe(NUIT_A_PARIS, 'America/New_York'), 21);
    assert.equal(estHeureSilencieuse(NUIT_A_PARIS, 'America/New_York'), false);
  });
});

describe('« demain » est une date, pas 24 heures', () => {
  const NY = 'America/New_York';
  const demainParDuree = (now: Date) => jourLocal(new Date(now.getTime() + 24 * 60 * 60 * 1000), NY);
  const demainParCalendrier = (now: Date) => ajouterJours(jourLocal(now, NY), 1);

  it('AUTOMNE : +24 h reste sur la MÊME date (la journée dure 25 h)', () => {
    // 2027-11-07 à 00:30 à New York, jour du retour à l'heure d'hiver.
    const now = new Date('2027-11-07T04:30:00Z');
    assert.equal(jourLocal(now, NY), '2027-11-07');
    assert.equal(demainParDuree(now), '2027-11-07', 'le bug : « demain » = aujourd’hui');
    assert.equal(demainParCalendrier(now), '2027-11-08');
  });

  it('PRINTEMPS : +24 h SAUTE une date (la journée dure 23 h)', () => {
    // 2027-03-13 à 23:30 à New York, veille du passage à l'heure d'été.
    const now = new Date('2027-03-14T04:30:00Z');
    assert.equal(jourLocal(now, NY), '2027-03-13');
    assert.equal(demainParDuree(now), '2027-03-15', 'le bug : « demain » = après-demain');
    assert.equal(demainParCalendrier(now), '2027-03-14');
  });

  it('un jour ordinaire, les deux méthodes concordent', () => {
    const now = new Date('2027-06-15T12:00:00Z');
    assert.equal(demainParDuree(now), demainParCalendrier(now));
  });
});

describe('le récapitulatif de 20 h : « demain » chez le salon', () => {
  // 20:00 à Paris le 16 novembre 2026 = 19:00Z ; il est 23:00 à La Réunion.
  const A_20H_PARIS = new Date('2026-11-16T19:00:00Z');

  it('demain est le 17 à Paris comme à La Réunion — ce soir-là', () => {
    assert.equal(demainChezLeSalon(A_20H_PARIS, 'Europe/Paris'), '2026-11-17');
    assert.equal(demainChezLeSalon(A_20H_PARIS, 'Indian/Reunion'), '2026-11-17');
  });

  it('LE BUG : un rendez-vous réunionnais de 8 h le 17 sortait de la plage parisienne', () => {
    // 08:00 à La Réunion le 17 = 04:00Z = 05:00 à Paris le 17 : dedans.
    // Mais 22:00 à La Réunion le 17 = 18:00Z = 19:00 à Paris : dedans aussi,
    // alors que 01:00 à La Réunion le 18 = 21:00Z le 17 = 22:00 Paris le 17 →
    // la plage parisienne l'INCLUAIT dans « demain » : un rendez-vous du
    // surlendemain matin listé ce soir.
    const rdvSurlendemain = { datetime: new Date('2026-11-17T21:00:00Z'), timezone: 'Indian/Reunion' };
    assert.equal(jourLocal(rdvSurlendemain.datetime, 'Europe/Paris'), '2026-11-17', 'vu de Paris : demain');
    assert.equal(estDemainChezLeSalon(rdvSurlendemain, A_20H_PARIS, 'Indian/Reunion'), false, 'chez le salon : après-demain');
  });

  it('la date locale FIGÉE prime sur le recalcul', () => {
    const rdv = { datetime: new Date('2026-11-17T04:00:00Z'), timezone: 'Europe/Paris', localDate: '2026-11-17' };
    assert.equal(estDemainChezLeSalon(rdv, A_20H_PARIS, 'Indian/Reunion'), true);
  });

  it('sans fuseau figé, la réservation est lue dans celui du salon', () => {
    const rdv = { datetime: new Date('2026-11-17T04:00:00Z') };
    assert.equal(estDemainChezLeSalon(rdv, A_20H_PARIS, 'Indian/Reunion'), true);
    assert.equal(estDemainChezLeSalon(rdv, A_20H_PARIS, 'Europe/Paris'), true);
  });

  it('la fenêtre de recherche contient demain dans TOUS les fuseaux', () => {
    const { debut, fin } = fenetreDeRechercheDemain(A_20H_PARIS);
    // 00:00 le 17 à Kiritimati (UTC+14) = 10:00Z le 16.
    assert.ok(debut.getTime() <= new Date('2026-11-16T10:00:00Z').getTime());
    // 23:59 le 17 à Pago Pago (UTC−11) = 10:59Z le 18.
    assert.ok(fin.getTime() >= new Date('2026-11-18T10:59:00Z').getTime());
  });
});
