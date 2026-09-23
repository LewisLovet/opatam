/**
 * Le lecteur unique de l'heure d'un rendez-vous.
 *   npx tsx --test packages/shared/src/utils/rendezvous-affichage.test-tsx.ts
 *
 * En `tsx` et non `node --test` : ce module importe `./fuseaux` sans
 * extension, ce que le résolveur ESM de node refuse. Les tests qui
 * n'importent rien d'autre restent en `node --test`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  finDuRendezVous, fuseauADistinguer, fuseauDAffichage,
  heureDuRendezVous, jourDuRendezVous, plageDuRendezVous,
} from './rendezvous-affichage';

// 08:00 à La Réunion le 16 novembre 2026.
const REUNION = {
  datetime: new Date('2026-11-16T04:00:00Z'),
  endDatetime: new Date('2026-11-16T05:00:00Z'),
  timezone: 'Indian/Reunion',
  localDate: '2026-11-16',
  localStartTime: '08:00',
  localEndTime: '09:00',
};

// Une réservation d'AVANT le chantier : aucun champ local, aucun fuseau.
const ANCIENNE = {
  datetime: new Date('2026-11-16T08:00:00Z'),
  endDatetime: new Date('2026-11-16T09:00:00Z'),
};

describe('l’heure figée prime sur le recalcul', () => {
  it('un rendez-vous réunionnais dit 08:00, pas l’heure de Paris', () => {
    assert.equal(heureDuRendezVous(REUNION), '08:00');
    assert.equal(finDuRendezVous(REUNION), '09:00');
    assert.equal(jourDuRendezVous(REUNION), '2026-11-16');
    assert.equal(plageDuRendezVous(REUNION), '08:00 – 09:00');
  });

  it('elle survit à un changement de fuseau du lieu', () => {
    // Le pro corrige son fuseau : les rendez-vous PASSÉS ne doivent pas
    // changer d'heure à l'écran. Une confirmation disant 08:00 dit 08:00.
    const apresCorrection = { ...REUNION, timezone: 'Europe/Paris' };
    assert.equal(heureDuRendezVous(apresCorrection), '08:00');
  });

  it('sans heure figée, on recalcule dans le fuseau du rendez-vous', () => {
    const sansFige = { ...REUNION, localStartTime: null, localEndTime: null, localDate: null };
    assert.equal(heureDuRendezVous(sansFige), '08:00');
    assert.equal(jourDuRendezVous(sansFige), '2026-11-16');
  });
});

describe('les réservations d’avant le chantier ne changent pas', () => {
  it('elles restent lues à l’heure de Paris, comme les 120 occurrences en dur', () => {
    // Repli explicite = comportement inchangé, pas régression déguisée.
    assert.equal(fuseauDAffichage(ANCIENNE), 'Europe/Paris');
    assert.equal(heureDuRendezVous(ANCIENNE), '09:00');
    assert.equal(plageDuRendezVous(ANCIENNE), '09:00 – 10:00');
  });

  it('un fuseau invalide en base ne casse pas l’affichage', () => {
    assert.equal(heureDuRendezVous({ ...ANCIENNE, timezone: '+04:00' }), '09:00');
  });

  it('une fin inconnue rend juste l’heure de début', () => {
    assert.equal(plageDuRendezVous({ datetime: ANCIENNE.datetime }), '09:00');
    assert.equal(finDuRendezVous({ datetime: ANCIENNE.datetime }), null);
  });
});

describe('quand faut-il préciser le fuseau au lecteur ?', () => {
  it('une cliente parisienne chez un salon réunionnais : OUI', () => {
    assert.equal(fuseauADistinguer(REUNION, 'Europe/Paris'), true);
  });

  it('une cliente sur place : non', () => {
    assert.equal(fuseauADistinguer(REUNION, 'Indian/Reunion'), false);
  });

  it('deux fuseaux différents mais de même heure : non', () => {
    // Paris et Berlin ne sont jamais décalés : le préciser n'apporterait
    // qu'un bruit inutile.
    const paris = { ...REUNION, timezone: 'Europe/Paris' };
    assert.equal(fuseauADistinguer(paris, 'Europe/Berlin'), false);
  });

  it('sans fuseau connu, on ne dit rien plutôt que d’inventer', () => {
    assert.equal(fuseauADistinguer(ANCIENNE, 'Europe/Paris'), false);
    assert.equal(fuseauADistinguer(REUNION, null), false);
  });
});
