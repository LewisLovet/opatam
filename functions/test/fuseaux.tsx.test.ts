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
