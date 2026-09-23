/**
 * ÉQUIVALENCE du moteur de créneaux — étape 2 du chantier fuseaux.
 *
 *   TZ=Europe/Paris npx tsx --test packages/firebase/src/services/scheduling.equivalence.test.ts
 *   (ou : ./packages/firebase/run-equivalence-creneaux.sh)
 *
 * ── À quoi sert ce fichier ──────────────────────────────────────────────
 * `generateTimeSlots` va recevoir un fuseau IANA explicite (étape 3). Avant
 * d'y toucher, on FIGE ce qu'il produit aujourd'hui, pour que le
 * remplacement se prouve au lieu de se plaider. C'est la règle maison sur
 * ce moteur : jamais de modification sans script d'équivalence.
 *
 * ── Le piège, et pourquoi ce fichier a DEUX parties ─────────────────────
 * Figer le comportement actuel en bloc graverait le bug dans les tests :
 * le moteur est déjà FAUX les deux dimanches de bascule. On sépare donc :
 *
 *   PARTIE 1 — ce qui doit rester IDENTIQUE au millième de seconde. Toutes
 *   les journées ordinaires, et aussi les heures d'ouverture des jours de
 *   bascule : la bascule européenne a lieu à 01:00 ou 02:00 locales, donc
 *   une plage 09:00–12:00 est déjà juste, même ce jour-là.
 *
 *   PARTIE 2 — ce qui doit DÉLIBÉRÉMENT changer. Les plages de nuit des
 *   jours de bascule, où le moteur produit aujourd'hui deux anomalies
 *   mesurées (voir plus bas). Ces attentes-là sont écrites comme « état
 *   actuel, connu faux » avec la cible à côté. Quand l'étape 3 les fera
 *   échouer, ce sera le signe attendu, pas une régression.
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
    date: Date,
    debut: string,
    fin: string,
    duree: number,
    pas: number,
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
    .generateTimeSlots(minuitLocal(jour), debut, fin, duree, pas)
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
      for (const s of moteur.generateTimeSlots(minuitLocal(jour), debut, fin, duree, pas)) {
        assert.equal(heureLocale(s.datetime, FUSEAU), s.start, `${nom} — créneau ${s.start}`);
        assert.equal(jourLocal(s.datetime, FUSEAU), jour, `${nom} — créneau ${s.start}`);
      }
    }
  });

  it('les instants sont strictement croissants et jamais dupliqués', () => {
    for (const [nom, jour, debut, fin, duree, pas] of INVARIANTS) {
      const instants = moteur
        .generateTimeSlots(minuitLocal(jour), debut, fin, duree, pas)
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
// PARTIE 2 — état actuel CONNU FAUX, doit changer à l'étape 3
// ────────────────────────────────────────────────────────────────────────

const A_CORRIGER: Cas[] = [
  ['bascule-printemps-nuit', '2026-03-29', '00:00', '06:00', 30, 30,
    '00:00>2026-03-28T23:00:00.000Z 00:30>2026-03-28T23:30:00.000Z 01:00>2026-03-29T00:00:00.000Z 01:30>2026-03-29T00:30:00.000Z 02:00>2026-03-29T01:00:00.000Z 02:30>2026-03-29T01:30:00.000Z 03:00>2026-03-29T01:00:00.000Z 03:30>2026-03-29T01:30:00.000Z 04:00>2026-03-29T02:00:00.000Z 04:30>2026-03-29T02:30:00.000Z 05:00>2026-03-29T03:00:00.000Z 05:30>2026-03-29T03:30:00.000Z'],
  ['bascule-automne-nuit', '2026-10-25', '00:00', '06:00', 30, 30,
    '00:00>2026-10-24T22:00:00.000Z 00:30>2026-10-24T22:30:00.000Z 01:00>2026-10-24T23:00:00.000Z 01:30>2026-10-24T23:30:00.000Z 02:00>2026-10-25T00:00:00.000Z 02:30>2026-10-25T00:30:00.000Z 03:00>2026-10-25T02:00:00.000Z 03:30>2026-10-25T02:30:00.000Z 04:00>2026-10-25T03:00:00.000Z 04:30>2026-10-25T03:30:00.000Z 05:00>2026-10-25T04:00:00.000Z 05:30>2026-10-25T04:30:00.000Z'],
];

describe('PARTIE 2 — anomalies figées, à corriger par l’étape 3', () => {
  for (const [nom, jour, debut, fin, duree, pas, gele] of A_CORRIGER) {
    it(`${nom} : état actuel figé (ces attentes DOIVENT changer)`, () => {
      assert.equal(serialiser(jour, debut, fin, duree, pas), gele);
    });
  }

  it('PRINTEMPS — deux créneaux différents tombent sur le MÊME instant', () => {
    // 02:00 et 03:00 pointent tous deux sur 2026-03-29T01:00:00Z. Le salon
    // paraît avoir deux disponibilités là où il n'en a qu'une, et la
    // cliente qui choisit « 02:00 » reçoit une confirmation pour une heure
    // qui n'a pas existé.
    const slots = moteur.generateTimeSlots(minuitLocal('2026-03-29'), '00:00', '06:00', 30, 30);
    const parEtiquette = new Map(slots.map((s) => [s.start, s.datetime.getTime()]));
    assert.equal(parEtiquette.get('02:00'), parEtiquette.get('03:00'));
    assert.equal(parEtiquette.get('02:30'), parEtiquette.get('03:30'));

    // CIBLE étape 3 : « 02:00 » et « 02:30 » n'existent pas ce jour-là,
    // aucun créneau n'est proposé, et plus aucun instant n'est dupliqué.
    const instants = slots.map((s) => s.datetime.getTime());
    assert.notEqual(new Set(instants).size, instants.length, 'doublon encore présent (attendu à ce stade)');
  });

  it('PRINTEMPS — l’étiquette ment sur l’heure réelle du rendez-vous', () => {
    const slots = moteur.generateTimeSlots(minuitLocal('2026-03-29'), '00:00', '06:00', 30, 30);
    const menteurs = slots.filter((s) => heureLocale(s.datetime, FUSEAU) !== s.start);
    assert.deepEqual(
      menteurs.map((s) => `${s.start} se produit en réalité à ${heureLocale(s.datetime, FUSEAU)}`),
      [
        '02:00 se produit en réalité à 03:00',
        '02:30 se produit en réalité à 03:30',
      ],
    );
    // CIBLE étape 3 : cette liste est VIDE.
  });

  it('AUTOMNE — une heure de capacité disparaît en silence', () => {
    // L'heure 02:00→03:00 locale existe DEUX fois ce jour-là. Le moteur
    // n'en propose qu'une : entre « 02:30 » et « 03:00 » il s'écoule 90
    // minutes réelles au lieu de 30.
    const slots = moteur.generateTimeSlots(minuitLocal('2026-10-25'), '00:00', '06:00', 30, 30);
    const parEtiquette = new Map(slots.map((s) => [s.start, s.datetime.getTime()]));
    const saut = (parEtiquette.get('03:00')! - parEtiquette.get('02:30')!) / 60_000;
    assert.equal(saut, 90);

    // La journée dure 25 h mais le moteur en couvre 24 : sur une plage de
    // 6 h murales, il rend 12 créneaux de 30 min pour 7 h réelles.
    assert.equal(slots.length, 12);
    const etendueReelle =
      (slots[slots.length - 1].datetime.getTime() - slots[0].datetime.getTime()) / 3_600_000;
    assert.equal(etendueReelle, 6.5);

    // CIBLE étape 3 : décision produit à prendre — soit l'heure doublée est
    // proposée deux fois (capacité réelle), soit une seule (capacité
    // annoncée), mais le choix doit être explicite et dit au prestataire.
  });
});
