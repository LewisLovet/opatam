/**
 * Résumé d'horaires de la vue Organisation.
 * node --experimental-strip-types --test packages/shared/src/utils/horaires.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resumerHoraires, horairesEnVigueur, preparerCopieHoraires } from './horaires.ts';

const jour = (dayOfWeek, start = '09:00', end = '18:00', extra = {}) => ({
  memberId: 'm1', dayOfWeek, isOpen: true, slots: [{ start, end }], effectiveFrom: null, ...extra,
});

describe('resumerHoraires', () => {
  it('cinq jours contigus deviennent une plage', () => {
    const h = [1, 2, 3, 4, 5].map((j) => jour(j));
    assert.equal(resumerHoraires(h, 'm1'), 'Lun–Ven · 9h–18h');
  });

  it('deux jours isolés sont énumérés, pas transformés en plage', () => {
    assert.equal(resumerHoraires([jour(1), jour(6)], 'm1'), 'Lun, Sam · 9h–18h');
  });

  it('le dimanche ferme la semaine, il n’ouvre pas', () => {
    const h = [5, 6, 0].map((j) => jour(j));
    assert.equal(resumerHoraires(h, 'm1'), 'Ven–Dim · 9h–18h');
  });

  it('des amplitudes différentes ne sont pas résumées par une fausse heure', () => {
    assert.equal(resumerHoraires([jour(1), jour(2, '10:00', '19:00')], 'm1'), 'Lun, Mar · horaires variables');
  });

  it('les minutes sont gardées quand il y en a', () => {
    assert.equal(resumerHoraires([jour(1, '09:30', '17:45')], 'm1'), 'Lun · 9h30–17h45');
  });

  it('la dernière plage du jour donne l’heure de fin', () => {
    const coupure = { ...jour(1), slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] };
    assert.equal(resumerHoraires([coupure], 'm1'), 'Lun · 9h–18h');
  });

  it('un jour ouvert SANS plage ne compte pas', () => {
    assert.equal(resumerHoraires([{ ...jour(1), slots: [] }], 'm1'), null);
  });

  it('aucun horaire enregistré → null, jamais une plage par défaut', () => {
    assert.equal(resumerHoraires([], 'm1'), null);
  });

  it('les horaires d’un autre membre ne fuient pas', () => {
    assert.equal(resumerHoraires([{ ...jour(1), memberId: 'm2' }], 'm1'), null);
  });
});

describe('horairesEnVigueur', () => {
  const maintenant = new Date('2026-09-19T12:00:00Z');

  it('un changement programmé pour plus tard est ignoré', () => {
    const futur = jour(1, '10:00', '20:00', { effectiveFrom: new Date('2026-10-01T00:00:00Z') });
    assert.deepEqual(horairesEnVigueur([futur], maintenant), []);
  });

  it('entre deux versions passées, la plus récente gagne', () => {
    const ancien = jour(1, '09:00', '18:00', { effectiveFrom: new Date('2026-01-01T00:00:00Z') });
    const recent = jour(1, '10:00', '19:00', { effectiveFrom: new Date('2026-09-01T00:00:00Z') });
    const gardes = horairesEnVigueur([ancien, recent], maintenant);
    assert.equal(gardes.length, 1);
    assert.equal(gardes[0].slots[0].start, '10:00');
  });

  it('un horaire sans date d’effet reste en vigueur', () => {
    assert.equal(horairesEnVigueur([jour(1)], maintenant).length, 1);
  });

  it('deux membres gardent chacun leur jour', () => {
    const a = jour(1);
    const b = { ...jour(1), memberId: 'm2' };
    assert.equal(horairesEnVigueur([a, b], maintenant).length, 2);
  });
});

describe('preparerCopieHoraires', () => {
  const maintenant = new Date('2026-09-20T12:00:00Z');

  it('rend la semaine ENTIÈRE, triée, prête pour setWeeklySchedule', () => {
    const source = [jour(3), jour(1), jour(2)];
    const prets = preparerCopieHoraires(source, maintenant);
    assert.deepEqual(prets.map((j) => j.dayOfWeek), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(prets[1], { dayOfWeek: 1, slots: [{ start: '09:00', end: '18:00' }], isOpen: true });
  });

  it('un jour que la source ne travaille PAS ferme ce jour chez la cible', () => {
    // On annonce « remplacés » : sans les jours absents, la cible gardait
    // son samedi ouvert alors que la source ne travaille jamais le samedi.
    const prets = preparerCopieHoraires([jour(1)], maintenant);
    const samedi = prets.find((j) => j.dayOfWeek === 6);
    assert.equal(samedi.isOpen, false);
    assert.deepEqual(samedi.slots, []);
  });

  it('NE copie PAS un changement programmé de la source', () => {
    const futur = jour(1, '10:00', '20:00', { effectiveFrom: new Date('2026-12-01T00:00:00Z') });
    assert.deepEqual(preparerCopieHoraires([futur], maintenant), []);
  });

  it('un jour fermé reste fermé chez la cible', () => {
    const ferme = { ...jour(0), isOpen: false, slots: [] };
    const prets = preparerCopieHoraires([ferme], maintenant);
    assert.equal(prets.length, 7);
    assert.equal(prets[0].isOpen, false);
    assert.deepEqual(prets[0].slots, []);
  });

  it('les plages sont recopiées, pas partagées par référence', () => {
    const source = [jour(1)];
    const prets = preparerCopieHoraires(source, maintenant);
    prets[1].slots.push({ start: '20:00', end: '21:00' });
    assert.equal(source[0].slots.length, 1, 'la source ne doit pas être modifiée');
  });

  it('une source sans aucun horaire ne produit rien à écrire', () => {
    // Surtout pas une semaine fermée : l'appelant s'arrête sur la liste
    // vide, sinon la copie effacerait les horaires de la cible.
    assert.deepEqual(preparerCopieHoraires([], maintenant), []);
  });

  it('entre deux versions passées, seule la plus récente est copiée', () => {
    const ancien = jour(1, '09:00', '18:00', { effectiveFrom: new Date('2026-01-01T00:00:00Z') });
    const recent = jour(1, '11:00', '16:00', { effectiveFrom: new Date('2026-09-01T00:00:00Z') });
    const prets = preparerCopieHoraires([ancien, recent], maintenant);
    assert.equal(prets.length, 7);
    assert.equal(prets[1].slots[0].start, '11:00');
  });
});

import { horaireEnVigueurLe } from './horaires.ts';

describe('horaires en vigueur un jour donné (changements programmés)', () => {
  const effet = (d) => d.toISOString().slice(0, 10);
  const base = { id: 'base', dayOfWeek: 1, effectiveFrom: null, slots: [{ start: '09:00', end: '18:00' }] };
  const nov = { id: 'nov', dayOfWeek: 1, effectiveFrom: new Date('2026-11-02T00:00:00Z'), slots: [{ start: '14:00', end: '20:00' }] };
  const dec = { id: 'dec', dayOfWeek: 1, effectiveFrom: new Date('2026-12-07T00:00:00Z'), slots: [] };
  const mardi = { id: 'mardi', dayOfWeek: 2, effectiveFrom: null, slots: [] };
  // L'ordre des documents ne doit JAMAIS décider (le moteur gardait le dernier lu).
  const ordres = [[base, nov, dec, mardi], [dec, nov, mardi, base], [nov, base, dec, mardi]];

  it('avant la date d’effet : les horaires de base, pas le changement programmé', () => {
    for (const docs of ordres) assert.equal(horaireEnVigueurLe(docs, 1, '2026-10-26', effet)?.id, 'base');
  });
  it('dès la date d’effet, et après : le changement', () => {
    for (const docs of ordres) {
      assert.equal(horaireEnVigueurLe(docs, 1, '2026-11-02', effet)?.id, 'nov');
      assert.equal(horaireEnVigueurLe(docs, 1, '2026-11-30', effet)?.id, 'nov');
    }
  });
  it('deux changements successifs : le plus récent déjà en vigueur', () => {
    for (const docs of ordres) assert.equal(horaireEnVigueurLe(docs, 1, '2026-12-07', effet)?.id, 'dec');
  });
  it('un autre jour de la semaine n’interfère pas ; aucun document → null', () => {
    assert.equal(horaireEnVigueurLe([base, nov, mardi], 2, '2026-11-03', effet)?.id, 'mardi');
    assert.equal(horaireEnVigueurLe([mardi], 1, '2026-11-02', effet), null);
  });
  it('seul un changement futur, sans base : rien avant sa date', () => {
    assert.equal(horaireEnVigueurLe([nov], 1, '2026-10-26', effet), null);
    assert.equal(horaireEnVigueurLe([nov], 1, '2026-11-09', effet)?.id, 'nov');
  });
  it('sans changement programmé : exactement comme avant (le seul document du jour)', () => {
    assert.equal(horaireEnVigueurLe([base, mardi], 1, '2026-10-26', effet), base);
  });
});

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('les lecteurs d’horaires passent tous par la règle « en vigueur »', () => {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const lire = (c) => readFileSync(resolve(racine, c), 'utf8');
  it('moteur de créneaux : les trois calculs et la vérification finale', () => {
    const src = lire('packages/firebase/src/services/scheduling.service.ts');
    assert.doesNotMatch(src, /availabilityByDow/, 'plus de table « dernier document lu »');
    assert.equal((src.match(/horaireEnVigueurLe\(/g) ?? []).length, 4);
    assert.doesNotMatch(src, /await availabilityRepository\.get\(\s*providerId,\s*memberId,\s*dayOfWeek/);
  });
  it('prochaine disponibilité (functions) : le miroir', () => {
    const src = lire('functions/src/utils/calculateNextAvailableSlot.ts');
    assert.match(src, /horaireEnVigueurLe\(availabilities, dayOfWeek, jour/);
    assert.doesNotMatch(src, /availabilities\.set\(data\.dayOfWeek/);
  });
});
