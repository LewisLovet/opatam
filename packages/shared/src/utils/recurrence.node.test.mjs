/**
 * Récurrence des périodes bloquées — le générateur d'occurrences.
 *
 *   TZ=Europe/Paris node --experimental-strip-types --test packages/shared/src/utils/recurrence.node.test.mjs
 *
 * Le fuseau de la machine est FIXÉ à Europe/Paris : le générateur travaille
 * en composantes locales, exactement comme les formulaires, et les cas de
 * changement d'heure (29 mars et 25 octobre 2026) ne prouvent quelque chose
 * que dans un fuseau qui bascule.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  genererOccurrences,
  raisonRegleInvalide,
  messageRegleInvalide,
  joursEntre,
  trierJoursSemaine,
  HORIZON_MAX_JOURS,
} from './recurrence.ts';

before(() => {
  assert.equal(process.env.TZ, 'Europe/Paris', 'lancer avec TZ=Europe/Paris');
});

const d = (y, m, j, h = 0, min = 0) => new Date(y, m - 1, j, h, min);
const ymdhm = (x) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;

describe('1. week-ends chaque semaine : la période de base est la première occurrence', () => {
  // Samedi 4 avril 2026 09:00 → dimanche 5 avril 18:00, chaque semaine jusqu'au 3 mai.
  const base = { startDate: d(2026, 4, 4, 9), endDate: d(2026, 4, 5, 18) };
  const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [6], until: d(2026, 5, 3) });

  it('produit 5 week-ends, du 4 avril au 2 mai', () => {
    assert.deepEqual(
      occ.map((o) => ymdhm(o.startDate)),
      ['2026-04-04 09:00', '2026-04-11 09:00', '2026-04-18 09:00', '2026-04-25 09:00', '2026-05-02 09:00'],
    );
  });
  it('chaque occurrence garde la durée et l’heure de fin', () => {
    assert.deepEqual(
      occ.map((o) => ymdhm(o.endDate)),
      ['2026-04-05 18:00', '2026-04-12 18:00', '2026-04-19 18:00', '2026-04-26 18:00', '2026-05-03 18:00'],
    );
  });
  it('la première occurrence EST la période saisie, à l’instant près', () => {
    assert.equal(occ[0].startDate.getTime(), base.startDate.getTime());
    assert.equal(occ[0].endDate.getTime(), base.endDate.getTime());
  });
});

describe('2. une semaine sur deux, et `until` inclus', () => {
  const base = { startDate: d(2026, 6, 1, 9), endDate: d(2026, 6, 1, 12) }; // lundi
  it('saute une semaine sur deux', () => {
    const occ = genererOccurrences(base, { intervalWeeks: 2, weekdays: [1], until: d(2026, 7, 13) });
    assert.deepEqual(occ.map((o) => ymdhm(o.startDate).slice(0, 10)), ['2026-06-01', '2026-06-15', '2026-06-29', '2026-07-13']);
  });
  it('`until` est le dernier jour de départ INCLUS, quelle que soit son heure', () => {
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 6, 8, 0, 0) });
    assert.equal(occ.length, 2, 'le 8 juin à 00:00 compte encore');
    const occ2 = genererOccurrences(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 6, 7, 23, 59) });
    assert.equal(occ2.length, 1);
  });
  it('`until` le jour même : une seule occurrence', () => {
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 6, 1) });
    assert.equal(occ.length, 1);
  });
});

describe('3. plusieurs jours par semaine, semaine du lundi au dimanche', () => {
  // Base un JEUDI 4 juin ; répétée lundi + jeudi : le lundi 1er juin est AVANT la base, donc exclu.
  const base = { startDate: d(2026, 6, 4, 14), endDate: d(2026, 6, 4, 16) };
  it('les jours d’avant la période saisie ne sont pas générés, puis lundi et jeudi alternent', () => {
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [1, 4], until: d(2026, 6, 15) });
    assert.deepEqual(occ.map((o) => ymdhm(o.startDate).slice(0, 10)), ['2026-06-04', '2026-06-08', '2026-06-11', '2026-06-15']);
  });
  it('l’ordre des jours est indifférent et les doublons ignorés', () => {
    assert.deepEqual(trierJoursSemaine([0, 4, 1, 4]), [1, 4, 0]);
    const a = genererOccurrences(base, { intervalWeeks: 1, weekdays: [4, 1, 1], until: d(2026, 6, 15) });
    const b = genererOccurrences(base, { intervalWeeks: 1, weekdays: [1, 4], until: d(2026, 6, 15) });
    assert.deepEqual(a.map((o) => o.startDate.getTime()), b.map((o) => o.startDate.getTime()));
  });
  it('le dimanche vient en dernier dans la semaine (0 = dimanche, mais semaine du lundi)', () => {
    const lundi = { startDate: d(2026, 6, 1, 9), endDate: d(2026, 6, 1, 10) };
    const occ = genererOccurrences(lundi, { intervalWeeks: 1, weekdays: [0, 1], until: d(2026, 6, 8) });
    assert.deepEqual(occ.map((o) => ymdhm(o.startDate).slice(0, 10)), ['2026-06-01', '2026-06-07', '2026-06-08']);
  });
});

describe('4. changements d’heure : l’heure murale est conservée', () => {
  it('traverse le 29 mars 2026 sans décaler 09:00', () => {
    const base = { startDate: d(2026, 3, 23, 9), endDate: d(2026, 3, 23, 11) }; // lundi
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 4, 6) });
    assert.deepEqual(occ.map((o) => ymdhm(o.startDate)), ['2026-03-23 09:00', '2026-03-30 09:00', '2026-04-06 09:00']);
    // Preuve que ce n'est PAS « + 7 × 24 h » : l'écart en millisecondes change à la bascule.
    assert.equal(occ[1].startDate - occ[0].startDate, 7 * 86_400_000 - 3_600_000);
    assert.equal(occ[2].startDate - occ[1].startDate, 7 * 86_400_000);
  });
  it('traverse le 25 octobre 2026 de même', () => {
    const base = { startDate: d(2026, 10, 24, 9), endDate: d(2026, 10, 25, 18) }; // samedi → dimanche
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [6], until: d(2026, 11, 1) });
    assert.deepEqual(occ.map((o) => `${ymdhm(o.startDate)} → ${ymdhm(o.endDate)}`), [
      '2026-10-24 09:00 → 2026-10-25 18:00',
      '2026-10-31 09:00 → 2026-11-01 18:00',
    ]);
  });
});

describe('5. règles refusées : un code, et son message français', () => {
  const base = { startDate: d(2026, 4, 4, 9), endDate: d(2026, 4, 5, 18) }; // samedi → dimanche
  it('le jour de la période saisie doit être répété', () => {
    assert.equal(raisonRegleInvalide(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 5, 1) }), 'jourDeBaseAbsent');
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 5, 1) }), /jour de la période saisie/);
  });
  it('une période de plusieurs jours ne se répète que sur un seul jour', () => {
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1, weekdays: [6, 3], until: d(2026, 5, 1) }), /plusieurs jours/);
  });
  it('intervalle hors bornes', () => {
    assert.match(messageRegleInvalide(base, { intervalWeeks: 0, weekdays: [6], until: d(2026, 5, 1) }), /intervalle/);
    assert.match(messageRegleInvalide(base, { intervalWeeks: 5, weekdays: [6], until: d(2026, 5, 1) }), /intervalle/);
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1.5, weekdays: [6], until: d(2026, 5, 1) }), /intervalle/);
  });
  it('fin de répétition avant le départ, ou au-delà d’un an', () => {
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1, weekdays: [6], until: d(2026, 4, 3) }), /après la première/);
    assert.equal(raisonRegleInvalide(base, { intervalWeeks: 1, weekdays: [6], until: d(2027, 4, 5) }), null, '366 jours : accepté');
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1, weekdays: [6], until: d(2027, 4, 6) }), /un an/);
  });
  it('aucun jour, ou un jour hors 0–6', () => {
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1, weekdays: [], until: d(2026, 5, 1) }), /au moins un jour/);
    assert.match(messageRegleInvalide(base, { intervalWeeks: 1, weekdays: [7], until: d(2026, 5, 1) }), /au moins un jour/);
  });
  it('`genererOccurrences` lève sur une règle invalide', () => {
    assert.throws(() => genererOccurrences(base, { intervalWeeks: 1, weekdays: [1], until: d(2026, 5, 1) }));
  });
  it('un an de jours ouvrés tient sous la garde', () => {
    const lundi = { startDate: d(2026, 1, 5, 9), endDate: d(2026, 1, 5, 10) };
    const occ = genererOccurrences(lundi, { intervalWeeks: 1, weekdays: [1, 2, 3, 4, 5, 6, 0], until: d(2027, 1, 5) });
    assert.equal(occ.length, 366, 'chaque jour pendant un an, bornes comprises');
    // 365 jours d'écart : l'horizon en autorise 366 pour qu'une année bissextile passe.
    assert.equal(joursEntre(lundi.startDate, d(2027, 1, 5)), 365);
    assert.equal(HORIZON_MAX_JOURS, 366);
  });
});

describe('6. le schéma zod DÉCLARE les champs (zod retire les clés inconnues en silence)', () => {
  const ici = dirname(fileURLToPath(import.meta.url));
  const schema = readFileSync(resolve(ici, '../schemas/availability.schema.ts'), 'utf8');
  it('seriesId et recurrence sont dans blockedSlotSchema, isRecurring a disparu', () => {
    assert.match(schema, /seriesId: z\.string\(\)/);
    assert.match(schema, /recurrence: z\s*\.object\(/);
    assert.match(schema, /messageRegleInvalide\(data, data\.recurrence\)/, 'le schéma juge la règle avec le même code que le générateur');
    assert.doesNotMatch(schema, /isRecurring|recurringDays/, 'les anciens champs jamais implémentés ont été retirés');
  });
  it('le type BlockedSlot porte seriesId et recurrence', () => {
    const types = readFileSync(resolve(ici, '../types/index.ts'), 'utf8');
    assert.match(types, /seriesId\?: string \| null;/);
    assert.match(types, /recurrence\?: BlockedSlotRecurrence \| null;/);
  });
});
