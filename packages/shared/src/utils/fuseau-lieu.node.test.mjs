/**
 * Résolution du fuseau d'un lieu depuis ses coordonnées.
 *
 *   node --experimental-strip-types --test packages/shared/src/utils/fuseau-lieu.node.test.mjs
 *
 * Les coordonnées sont celles de vraies villes : un test sur des nombres
 * inventés ne dirait rien des boîtes englobantes.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aBesoinDeResolution, resoudreFuseauDeLieu } from './fuseau-lieu.ts';

const lieu = (latitude, longitude) => ({ latitude, longitude });

describe('le cas qui a déclenché le chantier', () => {
  it('Saint-Denis de La Réunion n’est PAS à l’heure de Paris', () => {
    // La Réunion est en `FR` : c'est exactement pourquoi la table par pays
    // ne suffit pas, et pourquoi le récapitulatif quotidien de ce salon
    // partait déjà à la mauvaise heure.
    const r = resoudreFuseauDeLieu(lieu(-20.8823, 55.4504), 'FR');
    assert.equal(r.fuseau, 'Indian/Reunion');
    assert.equal(r.motif, 'territoire');
    assert.equal(r.libelle, 'La Réunion');
  });

  it('Saint-Pierre de La Réunion aussi — la boîte couvre l’île entière', () => {
    assert.equal(resoudreFuseauDeLieu(lieu(-21.3393, 55.4781), 'FR').fuseau, 'Indian/Reunion');
  });
});

describe('les autres territoires français', () => {
  const cas = [
    ['Pointe-à-Pitre', 16.2412, -61.5331, 'America/Guadeloupe'],
    ['Fort-de-France', 14.6161, -61.0588, 'America/Martinique'],
    ['Cayenne', 4.9224, -52.3135, 'America/Cayenne'],
    ['Mamoudzou', -12.7806, 45.2278, 'Indian/Mayotte'],
    ['Saint-Pierre-et-Miquelon', 46.7808, -56.1764, 'America/Miquelon'],
    ['Papeete', -17.5516, -149.5585, 'Pacific/Tahiti'],
    ['Nouméa', -22.2758, 166.4580, 'Pacific/Noumea'],
  ];
  for (const [ville, lat, lon, attendu] of cas) {
    it(`${ville} → ${attendu}`, () => {
      assert.equal(resoudreFuseauDeLieu(lieu(lat, lon), 'FR').fuseau, attendu);
    });
  }
});

describe('la métropole et les pays voisins ne changent pas', () => {
  const cas = [
    ['Paris', 48.8566, 2.3522, 'FR', 'Europe/Paris'],
    ['Marseille', 43.2965, 5.3698, 'FR', 'Europe/Paris'],
    ['Bruxelles', 50.8503, 4.3517, 'BE', 'Europe/Brussels'],
    ['Lisbonne', 38.7223, -9.1393, 'PT', 'Europe/Lisbon'],
    ['Madrid', 40.4168, -3.7038, 'ES', 'Europe/Madrid'],
    ['Berlin', 52.5200, 13.4050, 'DE', 'Europe/Berlin'],
  ];
  for (const [ville, lat, lon, pays, attendu] of cas) {
    it(`${ville} → ${attendu}`, () => {
      const r = resoudreFuseauDeLieu(lieu(lat, lon), pays);
      assert.equal(r.fuseau, attendu);
      assert.equal(r.motif, 'pays');
    });
  }
});

describe('les archipels ibériques, décalés toute l’année', () => {
  it('Las Palmas (Canaries) n’est pas à l’heure de Madrid', () => {
    assert.equal(resoudreFuseauDeLieu(lieu(28.1235, -15.4363), 'ES').fuseau, 'Atlantic/Canary');
  });
  it('Ponta Delgada (Açores) n’est pas à l’heure de Lisbonne', () => {
    assert.equal(resoudreFuseauDeLieu(lieu(37.7412, -25.6756), 'PT').fuseau, 'Atlantic/Azores');
  });
  it('Funchal (Madère) suit Lisbonne mais par son propre fuseau', () => {
    assert.equal(resoudreFuseauDeLieu(lieu(32.6669, -16.9241), 'PT').fuseau, 'Atlantic/Madeira');
  });
});

describe('ce que le module REFUSE de deviner', () => {
  it('les États-Unis rendent null, pas une longitude approximative', () => {
    // Six fuseaux, des exceptions par comté (Arizona, Indiana). Une erreur
    // d'une heure passerait inaperçue jusqu'à la première cliente fâchée :
    // mieux vaut demander à l'API ou au professionnel.
    const r = resoudreFuseauDeLieu(lieu(40.7128, -74.0060), 'US');
    assert.equal(r.fuseau, null);
    assert.equal(r.motif, 'inconnu');
  });

  it('un pays non servi rend null', () => {
    assert.equal(resoudreFuseauDeLieu(lieu(35.6762, 139.6503), 'JP').fuseau, null);
  });

  it('sans coordonnées, le pays décide — et le libellé le DIT', () => {
    // C'est juste pour la métropole et faux pour l'outre-mer : le rapport
    // doit pouvoir signaler ces lieux-là.
    const r = resoudreFuseauDeLieu(null, 'FR');
    assert.equal(r.fuseau, 'Europe/Paris');
    assert.equal(r.libelle, 'FR (sans coordonnées)');
  });

  it('des coordonnées absurdes ne font pas tomber la résolution', () => {
    assert.equal(resoudreFuseauDeLieu(lieu(NaN, NaN), 'FR').fuseau, 'Europe/Paris');
    assert.equal(resoudreFuseauDeLieu(undefined, undefined).fuseau, null);
  });
});

describe('aBesoinDeResolution', () => {
  it('un lieu sans fuseau en a besoin', () => {
    assert.equal(aBesoinDeResolution({}), true);
    assert.equal(aBesoinDeResolution({ timezone: null }), true);
  });

  it('un fuseau posé À LA MAIN n’est JAMAIS recalculé', () => {
    // Une correction manuelle existe précisément parce que l'automatique
    // s'était trompé : la réécraser serait le pire des comportements.
    assert.equal(
      aBesoinDeResolution({ timezone: 'Indian/Reunion', timezoneSource: 'manual' }),
      false,
    );
    assert.equal(aBesoinDeResolution({ timezone: null, timezoneSource: 'manual' }), false);
  });

  it('un fuseau déjà résolu automatiquement n’est pas refait sans raison', () => {
    assert.equal(
      aBesoinDeResolution({ timezone: 'Europe/Paris', timezoneSource: 'automatic' }),
      false,
    );
  });
});
