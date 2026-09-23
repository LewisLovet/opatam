/**
 * ÉQUIVALENCE du moteur de créneaux — chantier fuseaux, étapes 2 et 3.
 *
 *   TZ=Europe/Paris npx tsx --test packages/firebase/src/services/scheduling.equivalence.test.ts
 *   (ou : ./packages/firebase/run-equivalence-creneaux.sh)
 *
 * ── À quoi sert ce fichier ──────────────────────────────────────────────
 * `generateTimeSlots` reçoit désormais un fuseau IANA explicite. Ce fichier
 * a figé ce que le moteur produisait AVANT (étape 2), puis a servi à
 * prouver ce que l'étape 3 a changé — et surtout ce qu'elle n'a PAS changé.
 * Règle maison sur ce moteur : jamais de modification sans équivalence.
 *
 * ── Pourquoi DEUX parties ───────────────────────────────────────────────
 * Figer le comportement en bloc aurait gravé le bug dans les tests : le
 * moteur était déjà FAUX les deux dimanches de bascule. D'où la séparation,
 * à conserver pour les étapes suivantes :
 *
 *   PARTIE 1 — ce qui ne doit JAMAIS bouger. Journées ordinaires, et aussi
 *   les heures d'ouverture des jours de bascule : la bascule européenne a
 *   lieu à 01:00 ou 02:00 locales, donc 09:00–12:00 était déjà juste.
 *   Ces attentes ont traversé l'étape 3 sans changer d'un millième.
 *
 *   PARTIE 2 — ce que l'étape 3 a corrigé, avec l'état d'avant en
 *   commentaire pour que la correction reste lisible dans six mois.
 *
 * ── Pourquoi TZ=Europe/Paris est imposé ─────────────────────────────────
 * C'est le fuseau que le serveur web force (`apps/web/next.config.ts`),
 * donc le seul comportement « de production » qu'on puisse figer. Un test
 * qui s'adapterait au fuseau de la machine ne prouverait rien — c'est
 * exactement le défaut qu'on corrige. Le fichier refuse donc de tourner
 * ailleurs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { heureLocale, jourLocal } from '@booking-app/shared';
import {
  availabilityRepository,
  blockedSlotRepository,
  bookingRepository,
  providerRepository,
  serviceRepository,
} from '../repositories';
import { schedulingService } from './scheduling.service';

const FUSEAU = 'Europe/Paris';
const tzMachine = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (tzMachine !== FUSEAU) {
  throw new Error(
    `Ce test fige le comportement du serveur web, qui tourne en ${FUSEAU}. ` +
      `La machine est en ${tzMachine}. Relancer avec :\n` +
      `  TZ=${FUSEAU} npx tsx --test packages/firebase/src/services/scheduling.equivalence.test.ts`,
  );
}

/**
 * `generateTimeSlots` est `private` en TypeScript — une annotation de
 * compilation, pas une barrière d'exécution. On la franchit sciemment :
 * caractériser le vrai code vaut mieux que tester une transcription qui
 * pourrait diverger de lui sans qu'on le voie.
 */
const moteur = schedulingService as unknown as {
  generateTimeSlots: (
    jour: string,
    debut: string,
    fin: string,
    duree: number,
    pas: number,
    fuseau?: string,
  ) => { start: string; end: string; datetime: Date; endDatetime: Date }[];
  toDateKey: (date: Date) => string;
};

/** Minuit local du jour donné — ce que le moteur reçoit aujourd'hui. */
function minuitLocal(jour: string): Date {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(a, m - 1, j);
}

/** « étiquette>instant » séparés par des espaces : lisible dans un diff. */
function serialiser(jour: string, debut: string, fin: string, duree: number, pas: number): string {
  return moteur
    .generateTimeSlots(jour, debut, fin, duree, pas, FUSEAU)
    .map((s) => `${s.start}>${s.datetime.toISOString()}`)
    .join(' ');
}

type Cas = [nom: string, jour: string, debut: string, fin: string, duree: number, pas: number, gele: string];

// ────────────────────────────────────────────────────────────────────────
// PARTIE 1 — doit rester identique après l'étape 3
// ────────────────────────────────────────────────────────────────────────

const INVARIANTS: Cas[] = [
  ['ordinaire-hiver', '2026-01-15', '09:00', '12:00', 60, 30,
    '09:00>2026-01-15T08:00:00.000Z 09:30>2026-01-15T08:30:00.000Z 10:00>2026-01-15T09:00:00.000Z 10:30>2026-01-15T09:30:00.000Z 11:00>2026-01-15T10:00:00.000Z'],
  ['ordinaire-ete', '2026-07-15', '09:00', '12:00', 60, 30,
    '09:00>2026-07-15T07:00:00.000Z 09:30>2026-07-15T07:30:00.000Z 10:00>2026-07-15T08:00:00.000Z 10:30>2026-07-15T08:30:00.000Z 11:00>2026-07-15T09:00:00.000Z'],
  // Une plage qui finit à « 00:00 » vaut minuit = FIN de journée (1440).
  ['soiree-jusqua-minuit', '2026-07-15', '22:00', '00:00', 30, 30,
    '22:00>2026-07-15T20:00:00.000Z 22:30>2026-07-15T20:30:00.000Z 23:00>2026-07-15T21:00:00.000Z 23:30>2026-07-15T21:30:00.000Z'],
  ['pas-de-15-min', '2026-09-23', '09:00', '10:30', 45, 15,
    '09:00>2026-09-23T07:00:00.000Z 09:15>2026-09-23T07:15:00.000Z 09:30>2026-09-23T07:30:00.000Z 09:45>2026-09-23T07:45:00.000Z'],
  ['prestation-longue', '2026-09-23', '09:00', '18:00', 180, 60,
    '09:00>2026-09-23T07:00:00.000Z 10:00>2026-09-23T08:00:00.000Z 11:00>2026-09-23T09:00:00.000Z 12:00>2026-09-23T10:00:00.000Z 13:00>2026-09-23T11:00:00.000Z 14:00>2026-09-23T12:00:00.000Z 15:00>2026-09-23T13:00:00.000Z'],
  // Jours de bascule, mais AUX HEURES D'OUVERTURE : déjà justes, parce que
  // la bascule européenne a lieu au milieu de la nuit.
  ['bascule-printemps-jour', '2026-03-29', '09:00', '12:00', 60, 30,
    '09:00>2026-03-29T07:00:00.000Z 09:30>2026-03-29T07:30:00.000Z 10:00>2026-03-29T08:00:00.000Z 10:30>2026-03-29T08:30:00.000Z 11:00>2026-03-29T09:00:00.000Z'],
  ['bascule-automne-jour', '2026-10-25', '09:00', '12:00', 60, 30,
    '09:00>2026-10-25T08:00:00.000Z 09:30>2026-10-25T08:30:00.000Z 10:00>2026-10-25T09:00:00.000Z 10:30>2026-10-25T09:30:00.000Z 11:00>2026-10-25T10:00:00.000Z'],
];

describe('PARTIE 1 — à ne PAS faire bouger', () => {
  for (const [nom, jour, debut, fin, duree, pas, gele] of INVARIANTS) {
    it(`${nom} : sortie inchangée`, () => {
      assert.equal(serialiser(jour, debut, fin, duree, pas), gele);
    });
  }

  it('chaque créneau porte bien l’heure locale qu’il annonce', () => {
    // L'invariant de fond, celui que l'étape 3 doit préserver puis étendre
    // aux jours de bascule : l'étiquette dit la vérité sur place.
    for (const [nom, jour, debut, fin, duree, pas] of INVARIANTS) {
      for (const s of moteur.generateTimeSlots(jour, debut, fin, duree, pas, FUSEAU)) {
        assert.equal(heureLocale(s.datetime, FUSEAU), s.start, `${nom} — créneau ${s.start}`);
        assert.equal(jourLocal(s.datetime, FUSEAU), jour, `${nom} — créneau ${s.start}`);
      }
    }
  });

  it('les instants sont strictement croissants et jamais dupliqués', () => {
    for (const [nom, jour, debut, fin, duree, pas] of INVARIANTS) {
      const instants = moteur
        .generateTimeSlots(jour, debut, fin, duree, pas, FUSEAU)
        .map((s) => s.datetime.getTime());
      for (let i = 1; i < instants.length; i++) {
        assert.ok(instants[i] > instants[i - 1], `${nom} — créneau ${i} n’avance pas`);
      }
    }
  });

  it('toDateKey rend la date LOCALE de l’instant', () => {
    assert.equal(moteur.toDateKey(new Date('2026-09-22T23:30:00Z')), '2026-09-23');
    assert.equal(moteur.toDateKey(new Date('2026-03-29T00:30:00Z')), '2026-03-29');
    assert.equal(moteur.toDateKey(new Date('2026-10-25T00:30:00Z')), '2026-10-25');
  });
});

// ────────────────────────────────────────────────────────────────────────
// PARTIE 2 — CORRIGÉ par l'étape 3
// ────────────────────────────────────────────────────────────────────────
//
// Ces attentes décrivaient l'état d'avant. Elles ont été remplacées par la
// cible une fois `generateTimeSlots` passé à un fuseau explicite. Les
// commentaires gardent ce que le moteur faisait, pour que la correction
// reste lisible dans six mois.

const CORRIGES: Cas[] = [
  // AVANT : 12 créneaux, dont « 02:00 » et « 02:30 » qui n'existent pas ce
  // jour-là et tombaient sur les MÊMES instants que « 03:00 » et « 03:30 ».
  // APRÈS : 10 créneaux, les deux heures sautées ne sont plus proposées.
  ['bascule-printemps-nuit', '2026-03-29', '00:00', '06:00', 30, 30,
    '00:00>2026-03-28T23:00:00.000Z 00:30>2026-03-28T23:30:00.000Z 01:00>2026-03-29T00:00:00.000Z 01:30>2026-03-29T00:30:00.000Z 03:00>2026-03-29T01:00:00.000Z 03:30>2026-03-29T01:30:00.000Z 04:00>2026-03-29T02:00:00.000Z 04:30>2026-03-29T02:30:00.000Z 05:00>2026-03-29T03:00:00.000Z 05:30>2026-03-29T03:30:00.000Z'],
  // AUTOMNE : INCHANGÉ, et c'est une DÉCISION PRODUIT (2026-09-23) — l'heure
  // qui existe deux fois n'est proposée qu'UNE SEULE fois. Le socle sait
  // rendre les deux occurrences (`{ ambigu: 'seconde' }`) si l'on change
  // d'avis ; en attendant, le salon annonce 24 h sur une journée qui en dure
  // 25, et le prestataire doit le savoir.
  ['bascule-automne-nuit', '2026-10-25', '00:00', '06:00', 30, 30,
    '00:00>2026-10-24T22:00:00.000Z 00:30>2026-10-24T22:30:00.000Z 01:00>2026-10-24T23:00:00.000Z 01:30>2026-10-24T23:30:00.000Z 02:00>2026-10-25T00:00:00.000Z 02:30>2026-10-25T00:30:00.000Z 03:00>2026-10-25T02:00:00.000Z 03:30>2026-10-25T02:30:00.000Z 04:00>2026-10-25T03:00:00.000Z 04:30>2026-10-25T03:30:00.000Z 05:00>2026-10-25T04:00:00.000Z 05:30>2026-10-25T04:30:00.000Z'],
];

describe('PARTIE 2 — corrigé par l’étape 3', () => {
  for (const [nom, jour, debut, fin, duree, pas, gele] of CORRIGES) {
    it(`${nom} : sortie figée`, () => {
      assert.equal(serialiser(jour, debut, fin, duree, pas), gele);
    });
  }

  it('PRINTEMPS — plus aucun instant dupliqué', () => {
    // AVANT : « 02:00 » et « 03:00 » tombaient tous deux sur 01:00Z. Le
    // salon paraissait avoir deux disponibilités pour une seule.
    const slots = moteur.generateTimeSlots('2026-03-29', '00:00', '06:00', 30, 30, FUSEAU);
    const instants = slots.map((s) => s.datetime.getTime());
    assert.equal(new Set(instants).size, instants.length);
  });

  it('PRINTEMPS — les heures sautées ne sont plus proposées', () => {
    const slots = moteur.generateTimeSlots('2026-03-29', '00:00', '06:00', 30, 30, FUSEAU);
    const etiquettes = slots.map((s) => s.start);
    assert.ok(!etiquettes.includes('02:00'), '« 02:00 » n’existe pas ce jour-là');
    assert.ok(!etiquettes.includes('02:30'), '« 02:30 » n’existe pas ce jour-là');
    assert.equal(slots.length, 10, '12 créneaux avant, 10 après');
  });

  it('PRINTEMPS — plus aucune étiquette ne ment', () => {
    // AVANT : « 02:00 se produit en réalité à 03:00 ». La cliente recevait
    // une confirmation pour une heure qui n'a jamais existé.
    for (const [, jour, debut, fin, duree, pas] of CORRIGES) {
      for (const s of moteur.generateTimeSlots(jour, debut, fin, duree, pas, FUSEAU)) {
        assert.equal(heureLocale(s.datetime, FUSEAU), s.start);
      }
    }
  });

  it('la durée réelle d’un créneau est celle de la prestation', () => {
    // La fin se calcule en temps RÉEL : une prestation d'une heure dure une
    // heure, même si l'horloge saute pendant.
    for (const [, jour, debut, fin, duree, pas] of [...INVARIANTS, ...CORRIGES]) {
      for (const s of moteur.generateTimeSlots(jour, debut, fin, duree, pas, FUSEAU)) {
        assert.equal((s.endDatetime.getTime() - s.datetime.getTime()) / 60_000, duree);
      }
    }
  });

  it('AUTOMNE — l’heure doublée n’est proposée qu’une fois (décision produit)', () => {
    const slots = moteur.generateTimeSlots('2026-10-25', '00:00', '06:00', 30, 30, FUSEAU);
    const parEtiquette = new Map(slots.map((s) => [s.start, s.datetime.getTime()]));
    // 90 minutes réelles entre « 02:30 » et « 03:00 » : l'heure répétée est
    // vécue une fois. C'est voulu, pas subi.
    assert.equal((parEtiquette.get('03:00')! - parEtiquette.get('02:30')!) / 60_000, 90);
    assert.equal(slots.length, 12);
  });

  it('un fuseau invalide LÈVE au lieu de retomber sur Paris', () => {
    assert.throws(
      () => moteur.generateTimeSlots('2026-09-23', '09:00', '12:00', 60, 30, '+04:00'),
      /IANA/,
    );
  });

  it('un salon réunionnais obtient enfin ses propres heures', () => {
    // Le but de tout le chantier, en une ligne : 08:00 configuré à La
    // Réunion vaut 04:00 UTC, pas 06:00 comme si le salon était à Paris.
    const [reunion] = moteur.generateTimeSlots('2026-09-23', '08:00', '09:00', 60, 30, 'Indian/Reunion');
    assert.equal(reunion.datetime.toISOString(), '2026-09-23T04:00:00.000Z');
    assert.equal(heureLocale(reunion.datetime, 'Indian/Reunion'), '08:00');
  });
});

// ────────────────────────────────────────────────────────────────────────
// BOUCLE DE JOURS — le second endroit où le fuseau est implicite
// ────────────────────────────────────────────────────────────────────────
//
// `generateTimeSlots` n'est que la moitié du problème : la boucle qui
// l'appelle avance avec `cursor.setDate(+1)`, lit `cursor.getDay()` et
// appelle `toDateKey(cursor)` — trois lectures dans le fuseau de la
// machine. Un salon réunionnais peut donc se voir appliquer les horaires
// du mauvais jour de la semaine. On la couvre AVANT de la convertir.
//
// Les dépôts sont remplacés à chaud : ce sont des singletons exportés, et
// le service les appelle par accès de propriété. Pas de moqueur de modules
// nécessaire, donc pas de vitest.

function armerDepots(fenetre: [string, string], duree: number, pas: number): void {
  const anyOf = <T,>(o: T) => o as unknown as Record<string, unknown>;
  anyOf(serviceRepository).getById = async () => ({
    id: 's1', duration: duree, bufferTime: 0, isActive: true, isAvailable: true,
    memberIds: null, locationIds: [],
  });
  anyOf(providerRepository).getById = async () => ({
    id: 'p1',
    settings: { slotInterval: pas, minBookingNotice: 2, defaultBufferTime: 0, maxBookingAdvance: 1000 },
  });
  anyOf(availabilityRepository).getWeeklySchedule = async () =>
    [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      id: `a${dayOfWeek}`, dayOfWeek, isOpen: true,
      slots: [{ start: fenetre[0], end: fenetre[1] }], memberId: 'm1', locationId: 'l1',
    }));
  anyOf(bookingRepository).getUpcomingByProvider = async () => [];
  anyOf(blockedSlotRepository).getInRange = async () => [];
}

const minuit = (jour: string) => minuitLocal(jour);

async function serialiserBoucle(
  debut: string, fin: string, fenetre: [string, string], duree: number, pas: number,
): Promise<string> {
  armerDepots(fenetre, duree, pas);
  const slots = await schedulingService.getAvailableSlots({
    providerId: 'p1', serviceId: 's1', memberId: 'm1',
    startDate: minuit(debut), endDate: minuit(fin),
  });
  return slots.map((s) => `${s.start}>${s.datetime.toISOString()}`).join(' ');
}

type CasBoucle = [nom: string, debut: string, fin: string, fenetre: [string, string], duree: number, pas: number, gele: string];

const BOUCLES_INVARIANTES: CasBoucle[] = [
  ['boucle-semaine-ordinaire', '2026-11-16', '2026-11-18', ['09:00', '12:00'], 60, 30,
    '09:00>2026-11-16T08:00:00.000Z 09:30>2026-11-16T08:30:00.000Z 10:00>2026-11-16T09:00:00.000Z 10:30>2026-11-16T09:30:00.000Z 11:00>2026-11-16T10:00:00.000Z 09:00>2026-11-17T08:00:00.000Z 09:30>2026-11-17T08:30:00.000Z 10:00>2026-11-17T09:00:00.000Z 10:30>2026-11-17T09:30:00.000Z 11:00>2026-11-17T10:00:00.000Z 09:00>2026-11-18T08:00:00.000Z 09:30>2026-11-18T08:30:00.000Z 10:00>2026-11-18T09:00:00.000Z 10:30>2026-11-18T09:30:00.000Z 11:00>2026-11-18T10:00:00.000Z'],
  // AUTOMNE : la décision produit est « heure doublée proposée UNE SEULE
  // fois » — donc cette sortie ne doit PAS bouger à l'étape 3.
  ['boucle-bascule-automne', '2027-10-30', '2027-11-01', ['00:00', '06:00'], 30, 30,
    '00:00>2027-10-29T22:00:00.000Z 00:30>2027-10-29T22:30:00.000Z 01:00>2027-10-29T23:00:00.000Z 01:30>2027-10-29T23:30:00.000Z 02:00>2027-10-30T00:00:00.000Z 02:30>2027-10-30T00:30:00.000Z 03:00>2027-10-30T01:00:00.000Z 03:30>2027-10-30T01:30:00.000Z 04:00>2027-10-30T02:00:00.000Z 04:30>2027-10-30T02:30:00.000Z 05:00>2027-10-30T03:00:00.000Z 05:30>2027-10-30T03:30:00.000Z 00:00>2027-10-30T22:00:00.000Z 00:30>2027-10-30T22:30:00.000Z 01:00>2027-10-30T23:00:00.000Z 01:30>2027-10-30T23:30:00.000Z 02:00>2027-10-31T00:00:00.000Z 02:30>2027-10-31T00:30:00.000Z 03:00>2027-10-31T02:00:00.000Z 03:30>2027-10-31T02:30:00.000Z 04:00>2027-10-31T03:00:00.000Z 04:30>2027-10-31T03:30:00.000Z 05:00>2027-10-31T04:00:00.000Z 05:30>2027-10-31T04:30:00.000Z 00:00>2027-10-31T23:00:00.000Z 00:30>2027-10-31T23:30:00.000Z 01:00>2027-11-01T00:00:00.000Z 01:30>2027-11-01T00:30:00.000Z 02:00>2027-11-01T01:00:00.000Z 02:30>2027-11-01T01:30:00.000Z 03:00>2027-11-01T02:00:00.000Z 03:30>2027-11-01T02:30:00.000Z 04:00>2027-11-01T03:00:00.000Z 04:30>2027-11-01T03:30:00.000Z 05:00>2027-11-01T04:00:00.000Z 05:30>2027-11-01T04:30:00.000Z'],
];

describe('PARTIE 1 bis — boucle de jours, à ne PAS faire bouger', () => {
  for (const [nom, debut, fin, fenetre, duree, pas, gele] of BOUCLES_INVARIANTES) {
    it(`${nom} : sortie inchangée`, async () => {
      const rendu = await serialiserBoucle(debut, fin, fenetre, duree, pas);
      assert.notEqual(rendu, '', CAS_PERIME(debut));
      assert.equal(rendu, gele);
    });
  }
});

/** Message d'aide quand un cas est tombé dans le passé. */
function CAS_PERIME(debut: string): string {
  return (
    `Aucun créneau rendu pour ${debut}. Le moteur filtre le passé (préavis minimum), ` +
    `donc ce cas a EXPIRÉ : décaler les dates de test sur de prochains dimanches de ` +
    `bascule, recapturer les attentes, et les remplacer ici. Ce n’est pas une régression.`
  );
}

describe('PARTIE 2 bis — boucle de jours, corrigée', () => {
  it('boucle-bascule-printemps : plus de doublon le jour de la bascule', async () => {
    const rendu = await serialiserBoucle('2027-03-27', '2027-03-29', ['00:00', '06:00'], 30, 30);
    assert.notEqual(rendu, '', CAS_PERIME('2027-03-27'));
    // AVANT : « 02:00 » et « 03:00 » tombaient tous deux sur
    // 2027-03-28T01:00:00.000Z. Les deux heures sautées ont disparu.
    assert.ok(!rendu.includes('02:00>2027-03-28T01:00:00.000Z'));
    assert.ok(!rendu.includes('02:30>2027-03-28T01:30:00.000Z'));
    assert.ok(rendu.includes('03:00>2027-03-28T01:00:00.000Z'));
  });

  it('la liste et le résumé disent enfin la même chose', async () => {
    // AVANT : le résumé annonçait 11 pour le 28 mars (countNonOverlapping
    // dédoublonnait la collision) alors que la liste proposait 12 entrées.
    armerDepots(['00:00', '06:00'], 30, 30);
    const res = await schedulingService.getAvailabilitySummary({
      providerId: 'p1', serviceId: 's1', memberId: 'm1',
      startDate: minuit('2027-03-27'), endDate: minuit('2027-03-29'),
    });
    assert.equal(
      res.map((r) => `${r.date}:${r.status}:${r.capacity}`).join(' '),
      '2027-03-27:available:12 2027-03-28:available:10 2027-03-29:available:12',
    );
    const jour28 = res.find((r) => r.date === '2027-03-28')!;
    assert.equal(jour28.slots.length, jour28.capacity, 'liste et capacité concordent');
  });
});
