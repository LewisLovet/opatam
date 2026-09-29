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

// ─────────────────────────────────────────────────────────────────────────
// Troisième audit : plusieurs membres, édition depuis ailleurs, chargement.
// ─────────────────────────────────────────────────────────────────────────
import {
  periodeDepuisSaisie,
  saisieDepuisPeriode,
  fuseauxPrets,
  fuseauxDistincts,
} from './fuseaux.ts';

/** Ce que fait un écran MOBILE : un porteur de date du téléphone, relu par ses getters. */
const porteur = (jour, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return instantSaisi(jour, h * 60 + m, undefined);
};
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('4. plusieurs membres, plusieurs fuseaux : 09:00 dans CHAQUE lieu', () => {
  const saisie = { jourDebut: '2026-05-09', jourFin: '2026-05-09', heureDebut: '09:00', heureFin: '12:00', allDay: false };

  it('« 09:00 » saisi une fois vaut 09:00 à Paris ET 09:00 à New York', () => {
    const paris = periodeDepuisSaisie(saisie, 'Europe/Paris');
    const ny = periodeDepuisSaisie(saisie, 'America/New_York');
    assert.equal(heureDans(paris.startDate, 'Europe/Paris'), '09/05/2026 09:00');
    assert.equal(heureDans(ny.startDate, 'America/New_York'), '09/05/2026 09:00');
    assert.equal(heureDans(ny.endDate, 'America/New_York'), '09/05/2026 12:00');
    // Deux instants DIFFÉRENTS — six heures d'écart en mai.
    assert.equal(ny.startDate - paris.startDate, 6 * 3_600_000);
  });

  it('le défaut corrigé : un instant unique envoyé à toute l’équipe mettait New York à 03:00', () => {
    const unSeul = periodeDepuisSaisie(saisie, 'Europe/Paris');
    assert.equal(heureDans(unSeul.startDate, 'America/New_York'), '09/05/2026 03:00');
  });

  it('la répétition de chacun garde 09:00 chez lui, à travers les deux bascules décalées', () => {
    // Samedis du 7 mars au 4 avril : les États-Unis passent à l'heure d'été
    // le 8 mars, l'Europe le 29. Entre les deux, l'écart n'est plus que de
    // cinq heures — et chacun doit rester à 09:00 chez lui.
    const base = { jourDebut: '2026-03-07', jourFin: '2026-03-07', heureDebut: '09:00', heureFin: '12:00', allDay: false };
    const regle = { intervalWeeks: 1, weekdays: [6], until: '2026-04-04' };
    for (const fuseau of ['Europe/Paris', 'America/New_York']) {
      const occ = genererOccurrences(periodeDepuisSaisie(base, fuseau), regle, horlogeDuFuseau(fuseau));
      assert.equal(occ.length, 5, fuseau);
      assert.deepEqual(new Set(occ.map((o) => heureDans(o.startDate, fuseau).slice(11))), new Set(['09:00']), fuseau);
    }
  });

  it('l’écran sait quand les membres ne partagent pas le même fuseau', () => {
    const table = { a: 'Europe/Paris', b: 'America/New_York', c: 'Europe/Paris', d: null };
    assert.deepEqual(fuseauxDistincts(['a', 'c'], table), ['Europe/Paris']);
    assert.deepEqual(fuseauxDistincts(['a', 'b', 'd'], table).sort(), ['America/New_York', 'Europe/Paris']);
  });
});

describe('5. éditer depuis un autre fuseau ne déplace RIEN', () => {
  const LA = 'America/Los_Angeles';
  // Créée à Paris pour un salon de Los Angeles : 09:00 → 10:00 là-bas.
  const saisie = { jourDebut: '2026-05-09', jourFin: '2026-05-09', heureDebut: '09:00', heureFin: '10:00', allDay: false };
  const creee = periodeDepuisSaisie(saisie, LA);
  const stockee = { ...creee, allDay: false, startTime: '09:00', endTime: '10:00' };

  it('web : ouvrir, ne rien toucher, enregistrer → instants identiques', () => {
    const lu = saisieDepuisPeriode(stockee, LA);
    assert.deepEqual(lu, saisie, 'le formulaire affiche 09:00, le 9 mai');
    const reecrite = periodeDepuisSaisie(lu, LA);
    assert.equal(reecrite.startDate.getTime(), creee.startDate.getTime());
    assert.equal(reecrite.endDate.getTime(), creee.endDate.getTime());
  });

  it('mobile : même aller-retour, en passant par les dates-porteuses du téléphone', () => {
    const lu = saisieDepuisPeriode(stockee, LA);
    const debut = porteur(lu.jourDebut, lu.heureDebut);   // ce que tient l'écran
    const fin = porteur(lu.jourFin, lu.heureFin);
    assert.equal(hhmm(debut), '09:00', 'l’écran affiche 09:00, pas 18:00');
    const resaisie = { jourDebut: jourDeLAppareil(debut), jourFin: jourDeLAppareil(fin), heureDebut: hhmm(debut), heureFin: hhmm(fin), allDay: false };
    const reecrite = periodeDepuisSaisie(resaisie, LA);
    assert.equal(reecrite.startDate.getTime(), creee.startDate.getTime());
    assert.equal(reecrite.endDate.getTime(), creee.endDate.getTime());
  });

  it('le défaut corrigé : les getters de l’appareil lisaient 18:00, et la sauvegarde déplaçait l’activité', () => {
    assert.equal(hhmm(creee.startDate), '18:00', 'ce que voyait l’ancien formulaire, à Paris');
    const deplacee = instantSaisi(jourDeLAppareil(creee.startDate), 18 * 60, LA);
    assert.equal(heureDans(deplacee, LA), '09/05/2026 18:00', 'enregistrée sans rien toucher : 18:00 à LA');
  });

  it('une période ANCIENNE sans heures figées se relit dans le fuseau du lieu', () => {
    const lu = saisieDepuisPeriode({ ...creee, allDay: false, startTime: null, endTime: null }, LA);
    assert.equal(lu.heureDebut, '09:00');
    assert.equal(lu.heureFin, '10:00');
  });

  it('les heures FIGÉES priment : c’est elles que le moteur lit', () => {
    // Une période écrite avant la correction : instant au fuseau de l'appareil,
    // mais « 09:00 » figé. Le moteur lit 09:00 ; le formulaire aussi.
    const ancienne = { startDate: new Date(2026, 4, 9, 9, 0), endDate: new Date(2026, 4, 9, 10, 0), allDay: false, startTime: '09:00', endTime: '10:00' };
    const lu = saisieDepuisPeriode(ancienne, LA);
    assert.equal(lu.heureDebut, '09:00');
    assert.equal(lu.jourDebut, '2026-05-09', 'le jour, lu au salon (00:00 à LA le 9 mai)');
  });

  it('une activité finissant à MINUIT fait l’aller-retour sans glisser au lendemain', () => {
    const soir = { jourDebut: '2026-05-09', jourFin: '2026-05-09', heureDebut: '22:00', heureFin: '00:00', allDay: false };
    const p = periodeDepuisSaisie(soir, LA);
    const lu = saisieDepuisPeriode({ ...p, allDay: false, startTime: '22:00', endTime: '00:00' }, LA);
    assert.deepEqual(lu, soir);
    const reecrite = periodeDepuisSaisie(lu, LA);
    assert.equal(reecrite.endDate.getTime(), p.endDate.getTime());
  });

  it('une période sur plusieurs jours, à cheval sur la bascule, revient intacte', () => {
    // Vendredi 27 mars 18:00 → lundi 30 mars 09:00 à Paris : l'Europe passe
    // à l'heure d'été le dimanche 29.
    const conges = { jourDebut: '2026-03-27', jourFin: '2026-03-30', heureDebut: '18:00', heureFin: '09:00', allDay: false };
    const p = periodeDepuisSaisie(conges, 'Europe/Paris');
    assert.equal(heureDans(p.endDate, 'Europe/Paris'), '30/03/2026 09:00');
    const lu = saisieDepuisPeriode({ ...p, allDay: false, startTime: '18:00', endTime: '09:00' }, 'Europe/Paris');
    assert.deepEqual(lu, conges);
  });

  it('journée entière : 00:00 → 23:59 dans le fuseau du lieu', () => {
    const p = periodeDepuisSaisie({ jourDebut: '2026-05-09', jourFin: '2026-05-10', heureDebut: '09:00', heureFin: '18:00', allDay: true }, LA);
    assert.equal(heureDans(p.startDate, LA), '09/05/2026 00:00');
    assert.equal(heureDans(p.endDate, LA), '10/05/2026 23:59');
  });
});

describe('6. rien ne part tant que les fuseaux sont en cours de lecture', () => {
  it('absent de la table = lecture EN COURS ; null = lu, lieu sans fuseau', () => {
    assert.equal(fuseauxPrets(['a'], {}), false, 'rien de lu');
    assert.equal(fuseauxPrets(['a', 'b'], { a: 'Europe/Paris' }), false, 'un membre encore en cours');
    assert.equal(fuseauxPrets(['a', 'b'], { a: 'Europe/Paris', b: null }), true, 'lieu sans fuseau : pas bloquant');
    assert.equal(fuseauxPrets([], {}), true, 'aucun membre visé : rien à attendre');
  });
  it('changer de membre remet l’attente, sans relire ceux déjà connus', () => {
    const table = { a: 'Europe/Paris' };
    assert.equal(fuseauxPrets(['a'], table), true);
    assert.equal(fuseauxPrets(['a', 'nouveau'], table), false);
  });
  it('un vieux lieu SANS fuseau retombe sur l’appareil — comportement d’avant, pas de blocage', () => {
    const s = { jourDebut: '2026-05-09', jourFin: '2026-05-09', heureDebut: '09:00', heureFin: '10:00', allDay: false };
    assert.equal(periodeDepuisSaisie(s, null).startDate.getTime(), new Date(2026, 4, 9, 9, 0).getTime());
  });
});
