/**
 * Le PARCOURS réel : un professionnel saisit une heure sur son appareil,
 * et c'est l'heure DU SALON qui doit être écrite.
 *
 *   TZ=Europe/Paris node --experimental-strip-types --test packages/shared/src/utils/saisie-fuseau.node.test.mjs
 *
 * L'appareil est à Paris (`TZ` est fixé, et vérifié) ; les salons sont
 * ailleurs. Aucun instant n'est préparé « déjà converti » : on part de ce
 * que le formulaire a sous la main — une date « AAAA-MM-JJ » et une heure
 * murale — exactement comme les écrans, puis on déroule jusqu'aux
 * occurrences. C'est ce chemin-là qui produisait 00:00 à Los Angeles pour
 * un « 09:00 » tapé à Paris.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { instantSaisi, jourDeLAppareil, horlogeDuFuseau } from './fuseaux.ts';
import { genererOccurrences } from './recurrence.ts';

before(() => {
  assert.equal(process.env.TZ, 'Europe/Paris', 'lancer avec TZ=Europe/Paris');
});

/** L'heure murale lue dans un fuseau donné — ce que voit la cliente. */
const heureDans = (instant, fuseau) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, dateStyle: 'short', timeStyle: 'short' }).format(instant);

describe('1. l’heure saisie est celle du salon, pas celle de l’appareil', () => {
  it('« 09:00 » tapé à Paris pour un salon de Los Angeles vaut 09:00 LÀ-BAS', () => {
    const instant = instantSaisi('2026-05-09', 9 * 60, 'America/Los_Angeles');
    assert.equal(heureDans(instant, 'America/Los_Angeles'), '09/05/2026 09:00');
    // Le défaut d'avant : l'appareil décidait, et le salon voyait minuit.
    const ancien = new Date(2026, 4, 9, 9, 0);
    assert.equal(heureDans(ancien, 'America/Los_Angeles'), '09/05/2026 00:00');
    assert.notEqual(instant.getTime(), ancien.getTime());
  });

  it('le salon réunionnais reçoit bien 09:00, pas 09:00 de Paris', () => {
    const instant = instantSaisi('2026-05-09', 9 * 60, 'Indian/Reunion');
    assert.equal(heureDans(instant, 'Indian/Reunion'), '09/05/2026 09:00');
    assert.equal(instant.toISOString(), '2026-05-09T05:00:00.000Z');
  });

  it('même fuseau des deux côtés : rien ne change', () => {
    const instant = instantSaisi('2026-05-09', 9 * 60, 'Europe/Paris');
    assert.equal(instant.getTime(), new Date(2026, 4, 9, 9, 0).getTime());
  });

  it('fuseau inconnu : exactement le comportement d’avant, celui de l’appareil', () => {
    for (const rien of [undefined, null, '']) {
      const instant = instantSaisi('2026-05-09', 9 * 60, rien);
      assert.equal(instant.getTime(), new Date(2026, 4, 9, 9, 0).getTime(), `fuseau « ${rien} »`);
    }
  });

  it('aller-retour : le jour de l’appareil et l’heure murale redonnent l’instant', () => {
    const affiche = new Date(2026, 4, 9, 14, 30);
    const refait = instantSaisi(jourDeLAppareil(affiche), 14 * 60 + 30, 'Europe/Paris');
    assert.equal(refait.getTime(), affiche.getTime());
  });

  it('minuit au bout de la journée (1440) = début du lendemain', () => {
    const instant = instantSaisi('2026-05-09', 24 * 60, 'Europe/Paris');
    assert.equal(heureDans(instant, 'Europe/Paris'), '10/05/2026 00:00');
  });
});

describe('2. les deux dimanches de bascule ne font pas disparaître une saisie', () => {
  it('02:30 le 29 mars à Paris n’existe pas : l’heure est décalée, la journée tenue', () => {
    const instant = instantSaisi('2026-03-29', 2 * 60 + 30, 'Europe/Paris');
    assert.equal(heureDans(instant, 'Europe/Paris'), '29/03/2026 03:30', 'décalée du saut');
  });
  it('02:30 le 25 octobre à Paris existe deux fois : on prend la première', () => {
    const instant = instantSaisi('2026-10-25', 2 * 60 + 30, 'Europe/Paris');
    // La première occurrence est encore à l'heure d'été, donc UTC+2.
    assert.equal(instant.toISOString(), '2026-10-25T00:30:00.000Z');
  });
  it('minuit d’une journée qui commence à 01:00 (bascule à 00:00) reste dans SA journée', () => {
    // Le Chili bascule à minuit : le 6 septembre 2026, 00:00 n'existe pas.
    const instant = instantSaisi('2026-09-06', 0, 'America/Santiago');
    assert.match(heureDans(instant, 'America/Santiago'), /^06\/09\/2026/);
  });
});

describe('3. le parcours complet : saisir à Paris, répéter pour Los Angeles', () => {
  // Ce que le formulaire a sous la main : une date, une heure, un fuseau.
  const FUSEAU = 'America/Los_Angeles';
  const base = {
    startDate: instantSaisi('2026-03-07', 9 * 60, FUSEAU),   // samedi 09:00
    endDate: instantSaisi('2026-03-07', 12 * 60, FUSEAU),    // samedi 12:00
  };

  it('chaque samedi tombe à 09:00 au salon, y compris après LEUR changement d’heure', () => {
    // Les États-Unis basculent le 8 mars 2026 : la deuxième occurrence est
    // de l'autre côté. L'Europe, elle, bascule le 29 mars — entre les deux.
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [6], until: '2026-04-04' }, horlogeDuFuseau(FUSEAU));
    assert.deepEqual(
      occ.map((o) => heureDans(o.startDate, FUSEAU)),
      ['07/03/2026 09:00', '14/03/2026 09:00', '21/03/2026 09:00', '28/03/2026 09:00', '04/04/2026 09:00'],
    );
  });

  it('et la fin de chaque occurrence reste 12:00 au salon', () => {
    const occ = genererOccurrences(base, { intervalWeeks: 1, weekdays: [6], until: '2026-04-04' }, horlogeDuFuseau(FUSEAU));
    assert.deepEqual(new Set(occ.map((o) => heureDans(o.endDate, FUSEAU).slice(11))), new Set(['12:00']));
  });

  it('sans le fuseau du lieu, le même parcours produit minuit au salon — le défaut d’origine', () => {
    const ancien = { startDate: new Date(2026, 2, 7, 9, 0), endDate: new Date(2026, 2, 7, 12, 0) };
    const occ = genererOccurrences(ancien, { intervalWeeks: 1, weekdays: [6], until: '2026-04-04' });
    assert.equal(heureDans(occ[0].startDate, FUSEAU), '07/03/2026 00:00');
  });
});
