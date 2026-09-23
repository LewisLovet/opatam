/**
 * Socle horaire — conversions heure locale ↔ instant absolu.
 *
 * En node:test et non vitest : le lanceur vitest du dépôt est cassé
 * (binding @rolldown manquant). Lancement :
 *   node --experimental-strip-types --test packages/shared/src/utils/fuseaux.node.test.mjs
 *
 * Les instants attendus sont écrits en UTC EXPLICITE. Un test qui passerait
 * grâce au fuseau de la machine ne prouverait rien — c'est exactement le
 * défaut qu'on corrige.
 *
 * Bascules 2026 utilisées : États-Unis 8 mars et 1ᵉʳ novembre,
 * Europe 29 mars et 25 octobre.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ajouterJours,
  bornesDeJourLocal,
  decalageA,
  dureeDuJourLocal,
  estFuseauValide,
  estJourDeBascule,
  heureLocale,
  instantDepuisHeureLocale,
  jourLocal,
  jourSemaineLocal,
  minutesLocales,
  jourSemaineCalendaire,
  normaliserFuseau,
  resoudreHeureLocale,
} from './fuseaux.ts';

const h = (heures, minutes = 0) => heures * 60 + minutes;
/** Instant attendu, écrit en UTC. */
const utc = (iso) => new Date(iso).getTime();

describe('normaliserFuseau — un identifiant IANA, et rien d’autre', () => {
  it('rend la forme canonique', () => {
    assert.equal(normaliserFuseau('Europe/Paris'), 'Europe/Paris');
    assert.equal(normaliserFuseau('europe/paris'), 'Europe/Paris');
    assert.equal(normaliserFuseau('  Indian/Reunion  '), 'Indian/Reunion');
  });

  it('REFUSE un décalage brut, même si Intl l’accepte', () => {
    // `Intl` accepte "+04:00" (vérifié sur Node 22). Un décalage ignore les
    // changements d'heure : stocké sur un lieu, il reproduirait le bug six
    // mois plus tard.
    assert.equal(normaliserFuseau('+04:00'), null);
    assert.equal(normaliserFuseau('-05:00'), null);
    assert.equal(normaliserFuseau('UTC+4'), null);
    assert.equal(normaliserFuseau('Etc/GMT-4'), null);
  });

  it('refuse le vide et l’inconnu sans lever', () => {
    for (const mauvais of ['', '   ', 'Pas/UnFuseau', null, undefined, 42]) {
      assert.equal(normaliserFuseau(mauvais), null, `« ${mauvais} » devrait être refusé`);
    }
    assert.equal(estFuseauValide('Europe/Paris'), true);
    assert.equal(estFuseauValide('+04:00'), false);
  });
});

describe('heure locale → instant : les fuseaux du parc', () => {
  const cas = [
    ['Paris, hiver', '2026-01-15', 'Europe/Paris', '2026-01-15T07:00:00Z'],
    ['Paris, été', '2026-07-15', 'Europe/Paris', '2026-07-15T06:00:00Z'],
    ['Lisbonne, hiver', '2026-01-15', 'Europe/Lisbon', '2026-01-15T08:00:00Z'],
    ['Lisbonne, été', '2026-07-15', 'Europe/Lisbon', '2026-07-15T07:00:00Z'],
    ['La Réunion, janvier', '2026-01-15', 'Indian/Reunion', '2026-01-15T04:00:00Z'],
    ['La Réunion, juillet', '2026-07-15', 'Indian/Reunion', '2026-07-15T04:00:00Z'],
    ['New York, hiver', '2026-01-15', 'America/New_York', '2026-01-15T13:00:00Z'],
    ['New York, été', '2026-07-15', 'America/New_York', '2026-07-15T12:00:00Z'],
    ['Los Angeles, hiver', '2026-01-15', 'America/Los_Angeles', '2026-01-15T16:00:00Z'],
    ['Los Angeles, été', '2026-07-15', 'America/Los_Angeles', '2026-07-15T15:00:00Z'],
    ['Arizona, janvier', '2026-01-15', 'America/Phoenix', '2026-01-15T15:00:00Z'],
    ['Arizona, juillet', '2026-07-15', 'America/Phoenix', '2026-07-15T15:00:00Z'],
  ];

  for (const [libelle, jour, fuseau, attendu] of cas) {
    it(`${libelle} : 08:00 local = ${attendu}`, () => {
      const instant = instantDepuisHeureLocale(jour, h(8), fuseau);
      assert.equal(instant.getTime(), utc(attendu));
      // Et l'aller-retour redonne bien 08:00 sur place.
      assert.equal(heureLocale(instant, fuseau), '08:00');
      assert.equal(jourLocal(instant, fuseau), jour);
    });
  }

  it('La Réunion ne bouge JAMAIS — c’est Paris qui bouge autour', () => {
    // Le décalage Paris–Réunion passe de 3 h (hiver métropolitain) à 2 h
    // (été métropolitain) : un salon qui n'a rien changé voit ses rendez-vous
    // se décaler deux fois par an si le fuseau n'est pas explicite.
    const ecart = (jour) =>
      (instantDepuisHeureLocale(jour, h(8), 'Europe/Paris').getTime() -
        instantDepuisHeureLocale(jour, h(8), 'Indian/Reunion').getTime()) /
      3_600_000;
    assert.equal(ecart('2026-01-15'), 3, 'hiver métropolitain');
    assert.equal(ecart('2026-09-23'), 2, 'été métropolitain');
  });
});

describe('passage à l’heure d’été — la régression qui a motivé ce socle', () => {
  const NY = 'America/New_York';
  const BASCULE = '2026-03-08'; // 02:00 EST → 03:00 EDT

  it('l’heure sautée est NOMMÉE, pas déplacée en douce', () => {
    const r = resoudreHeureLocale(BASCULE, h(2, 30), NY);
    assert.equal(r.etat, 'inexistante');
    assert.equal(r.sautMinutes, 60);
    // Aucun créneau ne doit être proposé à une heure qui n'existe pas.
    assert.equal(instantDepuisHeureLocale(BASCULE, h(2, 30), NY), null);
  });

  it('03:30 reste 03:30 — l’ancien helper rendait 04:30', () => {
    // `instantLocal()` de apps/web/lib/ecran.ts échantillonne le décalage à
    // l'heure murale traitée comme de l'UTC. La bascule américaine a lieu à
    // 07:00 UTC, donc il prenait le décalage d'AVANT pour une heure d'APRÈS.
    const instant = instantDepuisHeureLocale(BASCULE, h(3, 30), NY);
    assert.equal(instant.getTime(), utc('2026-03-08T07:30:00Z'));
    assert.equal(heureLocale(instant, NY), '03:30');
  });

  it('les cinq heures que l’ancien helper décalait sont exactes', () => {
    // 02:00 à 06:59 local : l'ancien code rendait systématiquement +1 h.
    for (const heure of [3, 4, 5, 6]) {
      const instant = instantDepuisHeureLocale(BASCULE, h(heure), NY);
      assert.notEqual(instant, null, `${heure}:00 devrait exister`);
      assert.equal(heureLocale(instant, NY), `${String(heure).padStart(2, '0')}:00`);
    }
  });

  it('aucune heure de la journée n’est rendue décalée en silence', () => {
    // Le contrat : soit l'aller-retour redonne l'heure demandée, soit on
    // dit franchement qu'elle n'existe pas. Jamais autre chose.
    for (let minute = 0; minute < 24 * 60; minute += 15) {
      const instant = instantDepuisHeureLocale(BASCULE, minute, NY);
      if (instant === null) continue;
      assert.equal(minutesLocales(instant, NY), minute, `à ${minute} min de minuit`);
      assert.equal(jourLocal(instant, NY), BASCULE);
    }
  });

  it('Paris aussi, mais une seule heure manque', () => {
    // La bascule européenne a lieu à 01:00 UTC, avant toute heure
    // d'ouverture : c'est pour ça que le bug n'a jamais été vu ici.
    assert.equal(resoudreHeureLocale('2026-03-29', h(2, 30), 'Europe/Paris').etat, 'inexistante');
    const apres = instantDepuisHeureLocale('2026-03-29', h(3, 30), 'Europe/Paris');
    assert.equal(apres.getTime(), utc('2026-03-29T01:30:00Z'));
  });
});

describe('retour à l’heure d’hiver — l’heure qui existe deux fois', () => {
  it('New York : les deux occurrences sont rendues, une heure d’écart', () => {
    const r = resoudreHeureLocale('2026-11-01', h(1, 30), 'America/New_York');
    assert.equal(r.etat, 'ambigue');
    assert.equal(r.premiere.getTime(), utc('2026-11-01T05:30:00Z')); // encore EDT
    assert.equal(r.seconde.getTime(), utc('2026-11-01T06:30:00Z')); // déjà EST
    assert.equal(r.seconde.getTime() - r.premiere.getTime(), 3_600_000);
  });

  it('Paris : idem', () => {
    const r = resoudreHeureLocale('2026-10-25', h(2, 30), 'Europe/Paris');
    assert.equal(r.etat, 'ambigue');
    assert.equal(r.premiere.getTime(), utc('2026-10-25T00:30:00Z'));
    assert.equal(r.seconde.getTime(), utc('2026-10-25T01:30:00Z'));
  });

  it('la politique est EXPLICITE : première par défaut, seconde sur demande', () => {
    const premiere = instantDepuisHeureLocale('2026-11-01', h(1, 30), 'America/New_York');
    const seconde = instantDepuisHeureLocale('2026-11-01', h(1, 30), 'America/New_York', {
      ambigu: 'seconde',
    });
    assert.equal(premiere.getTime(), utc('2026-11-01T05:30:00Z'));
    assert.equal(seconde.getTime(), utc('2026-11-01T06:30:00Z'));
    // Les deux affichent bien 01:30 sur place : c'est tout le problème.
    assert.equal(heureLocale(premiere, 'America/New_York'), '01:30');
    assert.equal(heureLocale(seconde, 'America/New_York'), '01:30');
  });
});

describe('bornes de journée et durée réelle', () => {
  it('les bornes ne supposent jamais 24 h', () => {
    const { debut, fin } = bornesDeJourLocal('2026-03-08', 'America/New_York');
    assert.equal(debut.getTime(), utc('2026-03-08T05:00:00Z'));
    assert.equal(fin.getTime(), utc('2026-03-09T03:59:59.999Z'));
    // 23 h, pas 24 : la journée a perdu une heure.
    assert.equal(fin.getTime() - debut.getTime() + 1, 23 * 3_600_000);
  });

  it('une journée dure 1380, 1440 ou 1500 minutes', () => {
    assert.equal(dureeDuJourLocal('2026-03-08', 'America/New_York'), 1380);
    assert.equal(dureeDuJourLocal('2026-11-01', 'America/New_York'), 1500);
    assert.equal(dureeDuJourLocal('2026-03-29', 'Europe/Paris'), 1380);
    assert.equal(dureeDuJourLocal('2026-10-25', 'Europe/Paris'), 1500);
    assert.equal(dureeDuJourLocal('2026-06-15', 'Europe/Paris'), 1440);
    // La Réunion ne bascule jamais : aucune journée ne fait exception.
    assert.equal(dureeDuJourLocal('2026-03-29', 'Indian/Reunion'), 1440);
    assert.equal(dureeDuJourLocal('2026-10-25', 'Indian/Reunion'), 1440);
  });

  it('estJourDeBascule signale les deux dimanches, et eux seuls', () => {
    assert.equal(estJourDeBascule('2026-03-08', 'America/New_York'), true);
    assert.equal(estJourDeBascule('2026-03-09', 'America/New_York'), false);
    assert.equal(estJourDeBascule('2026-03-08', 'Indian/Reunion'), false);
  });

  it('un jour ordinaire fait bien 24 h', () => {
    const { debut, fin } = bornesDeJourLocal('2026-09-23', 'Indian/Reunion');
    assert.equal(debut.getTime(), utc('2026-09-22T20:00:00Z'));
    assert.equal(fin.getTime(), utc('2026-09-23T19:59:59.999Z'));
  });
});

describe('ajouterJours — arithmétique de calendrier, pas de durée', () => {
  it('franchit les mois, les années et les bissextiles', () => {
    assert.equal(ajouterJours('2026-01-31', 1), '2026-02-01');
    assert.equal(ajouterJours('2026-12-31', 1), '2027-01-01');
    assert.equal(ajouterJours('2026-01-01', -1), '2025-12-31');
    assert.equal(ajouterJours('2028-02-28', 1), '2028-02-29');
  });

  it('un jour de bascule reste un jour, pas 23 ou 25 heures', () => {
    assert.equal(ajouterJours('2026-03-08', 1), '2026-03-09');
    assert.equal(ajouterJours('2026-11-01', 1), '2026-11-02');
  });

  it('refuse une date mal formée plutôt que d’inventer', () => {
    assert.throws(() => ajouterJours('08/03/2026', 1), /YYYY-MM-DD/);
  });
});

describe('jourSemaineCalendaire — sans fuseau, parce qu’une date n’en a pas', () => {
  it('« le lundi 21 » est un lundi partout', () => {
    // C'est ce qu'il faut pour choisir les horaires d'ouverture d'un jour :
    // `new Date(...).getDay()` répond dans le fuseau de la machine, et un
    // salon réunionnais pouvait se voir appliquer le mauvais jour.
    assert.equal(jourSemaineCalendaire('2026-09-21'), 1);
    assert.equal(jourSemaineCalendaire('2026-09-20'), 0, 'dimanche');
    assert.equal(jourSemaineCalendaire('2026-09-26'), 6, 'samedi');
  });

  it('les jours de bascule ne font pas exception', () => {
    assert.equal(jourSemaineCalendaire('2026-03-29'), 0);
    assert.equal(jourSemaineCalendaire('2026-10-25'), 0);
  });

  it('refuse une date mal formée', () => {
    assert.throws(() => jourSemaineCalendaire('29/03/2026'), /YYYY-MM-DD/);
  });
});

describe('les situations métier du chantier', () => {
  it('un même instant s’affiche différemment selon qui regarde', () => {
    // Le rendez-vous est un instant ; seul son affichage change.
    const rdv = instantDepuisHeureLocale('2026-09-23', h(8), 'Indian/Reunion');
    assert.equal(heureLocale(rdv, 'Indian/Reunion'), '08:00'); // le salon
    assert.equal(heureLocale(rdv, 'Europe/Paris'), '06:00'); // la cliente à Paris
    assert.equal(heureLocale(rdv, 'America/New_York'), '00:00'); // et à New York
  });

  it('deux lieux dans deux fuseaux : même 08:00, instants différents', () => {
    const reunion = instantDepuisHeureLocale('2026-09-23', h(8), 'Indian/Reunion');
    const paris = instantDepuisHeureLocale('2026-09-23', h(8), 'Europe/Paris');
    assert.notEqual(reunion.getTime(), paris.getTime());
    assert.equal((paris.getTime() - reunion.getTime()) / 3_600_000, 2);
  });

  it('« 00:00 » en fin de plage vaut minuit du lendemain', () => {
    // Le code traite déjà une fin de plage à « 00:00 » comme 1440 minutes.
    const fin = instantDepuisHeureLocale('2026-09-23', 1440, 'Indian/Reunion');
    assert.equal(jourLocal(fin, 'Indian/Reunion'), '2026-09-24');
    assert.equal(heureLocale(fin, 'Indian/Reunion'), '00:00');
  });

  it('le jour de la semaine est celui du LIEU, pas celui du serveur', () => {
    // Lundi 21 septembre 2026, 08:00 à Paris : il est encore DIMANCHE 23:00
    // à Los Angeles. Un moteur qui lit le jour de la semaine ailleurs que
    // dans le fuseau du lieu applique les horaires du mauvais jour — et un
    // salon fermé le dimanche proposerait des créneaux.
    const rdv = instantDepuisHeureLocale('2026-09-21', h(8), 'Europe/Paris');
    assert.equal(jourSemaineLocal(rdv, 'Europe/Paris'), 1, 'lundi sur place');
    assert.equal(jourSemaineLocal(rdv, 'America/Los_Angeles'), 0, 'dimanche à Los Angeles');
    assert.equal(jourLocal(rdv, 'America/Los_Angeles'), '2026-09-20');
  });

  it('decalageA rend le décalage de l’instant, pas celui de la machine', () => {
    assert.equal(decalageA(new Date('2026-01-15T12:00:00Z'), 'America/New_York'), -5 * 3_600_000);
    assert.equal(decalageA(new Date('2026-07-15T12:00:00Z'), 'America/New_York'), -4 * 3_600_000);
    assert.equal(decalageA(new Date('2026-07-15T12:00:00Z'), 'Indian/Reunion'), 4 * 3_600_000);
  });

  it('un fuseau invalide LÈVE au lieu de retomber sur Paris', () => {
    // Le repli silencieux sur « Europe/Paris » est exactement ce qui a mis
    // ce fuseau sur les prestataires portugais.
    assert.throws(() => resoudreHeureLocale('2026-09-23', h(8), '+04:00'), /IANA/);
    assert.throws(() => resoudreHeureLocale('2026-09-23', h(8), ''), /IANA/);
  });
});
