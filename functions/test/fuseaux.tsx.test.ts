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
