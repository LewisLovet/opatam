/**
 * Règle « ce membre peut-il recevoir des réservations ? ».
 *
 * En node:test et non vitest : le lanceur vitest du dépôt est cassé
 * (binding @rolldown manquant), et cette règle est trop coûteuse en bugs
 * pour rester sans test. Lancement :
 *   node --experimental-strip-types --test packages/shared/src/utils/member-readiness.node.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diagnostiquerMembre, membreRealisePrestation } from './member-readiness.ts';

const HORAIRE_OK = { memberId: 'm1', isOpen: true, slots: [{ start: '09:00', end: '18:00' }] };
const PRESTA_LIBRE = { id: 's1', memberIds: null, locationIds: [] };

describe('diagnostiquerMembre', () => {
  it('membre actif, horaires enregistrés, prestation ouverte → réservable', () => {
    const e = diagnostiquerMembre({ id: 'm1', isActive: true, locationId: 'l1' }, [PRESTA_LIBRE], [HORAIRE_OK]);
    assert.equal(e.reservable, true);
    assert.deepEqual(e.blocages, []);
    assert.deepEqual(e.prestations, ['s1']);
  });

  it('AUCUN horaire en base → bloqué (le cas du compte Studio)', () => {
    const e = diagnostiquerMembre({ id: 'm1', isActive: true, locationId: 'l1' }, [PRESTA_LIBRE], []);
    assert.equal(e.reservable, false);
    assert.deepEqual(e.blocages, ['sansHoraires']);
  });

  it('jour ouvert mais SANS plage horaire → bloqué', () => {
    const e = diagnostiquerMembre(
      { id: 'm1', isActive: true, locationId: 'l1' },
      [PRESTA_LIBRE],
      [{ memberId: 'm1', isOpen: true, slots: [] }],
    );
    assert.deepEqual(e.blocages, ['sansHoraires']);
  });

  it('les horaires d’un AUTRE membre ne comptent pas', () => {
    const e = diagnostiquerMembre(
      { id: 'm1', isActive: true, locationId: 'l1' },
      [PRESTA_LIBRE],
      [{ ...HORAIRE_OK, memberId: 'm2' }],
    );
    assert.deepEqual(e.blocages, ['sansHoraires']);
  });

  it('aucune prestation ne le désigne → bloqué', () => {
    const e = diagnostiquerMembre(
      { id: 'm1', isActive: true, locationId: 'l1' },
      [{ id: 's1', memberIds: ['m2'], locationIds: [] }],
      [HORAIRE_OK],
    );
    assert.deepEqual(e.blocages, ['sansPrestation']);
  });

  it('une prestation suspendue ne rend pas réservable', () => {
    const e = diagnostiquerMembre(
      { id: 'm1', isActive: true, locationId: 'l1' },
      [{ ...PRESTA_LIBRE, isAvailable: false }],
      [HORAIRE_OK],
    );
    assert.deepEqual(e.blocages, ['sansPrestation']);
  });

  it('membre désactivé → cumule les blocages', () => {
    const e = diagnostiquerMembre({ id: 'm1', isActive: false, locationId: 'l1' }, [], []);
    assert.deepEqual(e.blocages, ['inactif', 'sansHoraires', 'sansPrestation']);
  });

  it('lieu désactivé → bloqué, même si tout le reste est en place', () => {
    // Désactiver un lieu ne détache personne et le tunnel ne lit que les
    // lieux actifs : ces membres passaient pour « prêts » sans l'être.
    const m = { id: 'm1', isActive: true, locationId: 'l1' };
    const e = diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK], ['l2']);
    assert.equal(e.reservable, false);
    assert.deepEqual(e.blocages, ['lieuInactif']);
  });

  it('lieu actif → aucun blocage', () => {
    const m = { id: 'm1', isActive: true, locationId: 'l1' };
    assert.equal(diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK], ['l1']).reservable, true);
  });

  it('liste de lieux ABSENTE : contrôle désactivé (l’écran charge encore)', () => {
    const m = { id: 'm1', isActive: true, locationId: 'l1' };
    assert.equal(diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK]).reservable, true);
    assert.equal(diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK], null).reservable, true);
  });

  it('liste VIDE : tous les lieux sont désactivés, donc personne n’est joignable', () => {
    // À ne pas confondre avec « on ne sait pas » : un lieu est créé à
    // l'inscription et locationId est obligatoire, une liste vraiment vide
    // veut dire que le pro a tout désactivé.
    const m = { id: 'm1', isActive: true, locationId: 'l1' };
    const e = diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK], []);
    assert.equal(e.reservable, false);
    assert.deepEqual(e.blocages, ['lieuInactif']);
  });

  it('membre SANS lieu : bloqué, il n’apparaît sous aucun lieu', () => {
    const m = { id: 'm1', isActive: true, locationId: null };
    const e = diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK], ['l1']);
    assert.equal(e.reservable, false);
    assert.deepEqual(e.blocages, ['lieuInactif']);
  });

  it('membre rattaché à un lieu INCONNU (supprimé) : bloqué', () => {
    const m = { id: 'm1', isActive: true, locationId: 'supprime' };
    assert.equal(diagnostiquerMembre(m, [PRESTA_LIBRE], [HORAIRE_OK], ['l1']).reservable, false);
  });
});

describe('membreRealisePrestation — cascade du tunnel client', () => {
  it('des membres désignés : seule cette liste compte', () => {
    assert.equal(membreRealisePrestation({ id: 's', memberIds: ['m1'], locationIds: [] }, 'm1', 'l1'), true);
    assert.equal(membreRealisePrestation({ id: 's', memberIds: ['m2'], locationIds: [] }, 'm1', 'l1'), false);
  });

  it('les membres désignés IGNORENT les lieux de la prestation', () => {
    // Prestation limitée au lieu B, membre du lieu A, mais nommément désigné.
    const s = { id: 's', memberIds: ['m1'], locationIds: ['lB'] };
    assert.equal(membreRealisePrestation(s, 'm1', 'lA'), true);
  });

  it('sans membres désignés, le lieu du membre décide', () => {
    const s = { id: 's', memberIds: null, locationIds: ['lA'] };
    assert.equal(membreRealisePrestation(s, 'm1', 'lA'), true);
    assert.equal(membreRealisePrestation(s, 'm1', 'lB'), false);
  });

  it('ni membres ni lieux → tout le monde la réalise', () => {
    assert.equal(membreRealisePrestation({ id: 's', memberIds: null, locationIds: [] }, 'm1', 'lA'), true);
  });

  it('liste de membres VIDE vaut « tout le monde », comme en base', () => {
    assert.equal(membreRealisePrestation({ id: 's', memberIds: [], locationIds: [] }, 'm1', 'lA'), true);
  });
});
