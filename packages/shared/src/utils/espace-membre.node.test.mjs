/**
 * L'état d'accès d'un membre, tel que l'écran Équipe du gérant l'affiche —
 * même règle sur le site et dans l'app.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { etatAccesMembre } from './espace-membre.ts';

const J = (jour) => new Date(`2026-10-${String(jour).padStart(2, '0')}T10:00:00Z`);
const MAINTENANT = J(10);

describe('état d’accès d’un membre', () => {
  it('aucun : jamais invité', () => {
    assert.deepEqual(etatAccesMembre('m1', [], [], MAINTENANT), { etat: 'aucun' });
  });
  it('actif : un compte relié et actif l’emporte sur toute invitation', () => {
    const e = etatAccesMembre(
      'm1',
      [{ memberId: 'm1', email: 'jean@x.test', active: true, linkedAt: J(3) }],
      [{ memberId: 'm1', status: 'pending', createdAt: J(9), expiresAt: J(16), email: 'jean@x.test' }],
      MAINTENANT,
    );
    assert.equal(e.etat, 'actif');
    assert.equal(e.email, 'jean@x.test');
  });
  it('invité : la plus RÉCENTE des invitations en attente, lien valable', () => {
    const e = etatAccesMembre('m1', [], [
      { memberId: 'm1', status: 'pending', createdAt: J(1), expiresAt: J(8), email: 'ancienne@x.test' },
      { memberId: 'm1', status: 'pending', createdAt: J(9), expiresAt: J(16), email: 'jean@x.test' },
    ], MAINTENANT);
    assert.equal(e.etat, 'invite');
    assert.equal(e.email, 'jean@x.test');
    assert.equal(e.expireLe.getTime(), J(16).getTime());
  });
  it('expiré : invitation en attente dont le lien est passé', () => {
    const e = etatAccesMembre('m1', [], [{ memberId: 'm1', status: 'pending', createdAt: J(1), expiresAt: J(8), email: 'jean@x.test' }], MAINTENANT);
    assert.equal(e.etat, 'expire');
  });
  it('aucun : accès retiré (compte supprimé), invitations remplacées, retirées ou acceptées', () => {
    const e = etatAccesMembre('m1', [], [
      { memberId: 'm1', status: 'accepted', createdAt: J(1), expiresAt: J(8) },
      { memberId: 'm1', status: 'revoked', createdAt: J(2), expiresAt: J(9) },
      { memberId: 'm1', status: 'replaced', createdAt: J(3), expiresAt: J(20) },
    ], MAINTENANT);
    assert.deepEqual(e, { etat: 'aucun' });
  });
  it('un compte désactivé ne compte pas comme accès', () => {
    assert.deepEqual(etatAccesMembre('m1', [{ memberId: 'm1', active: false }], [], MAINTENANT), { etat: 'aucun' });
  });
  it('ne mélange jamais les membres', () => {
    const e = etatAccesMembre('m2', [{ memberId: 'm1', active: true }], [{ memberId: 'm1', status: 'pending', expiresAt: J(20) }], MAINTENANT);
    assert.deepEqual(e, { etat: 'aucun' });
  });
});

import { espaceMembreOuvert } from './espace-membre.ts';

describe('interrupteur de l’espace membre', () => {
  it('fermé par défaut : document absent, illisible, ou salon non listé', () => {
    for (const cfg of [undefined, null, 'x', 42, {}, { allowedProviderIds: 'salon-a' }, { enabledForAll: 'true' }]) {
      assert.equal(espaceMembreOuvert(cfg, 'salon-a'), false, JSON.stringify(cfg));
    }
    assert.equal(espaceMembreOuvert({ allowedProviderIds: ['salon-b'] }, 'salon-a'), false);
    assert.equal(espaceMembreOuvert({ enabledForAll: true }, null), false);
  });
  it('ouvert : salon listé (phase de test), ou tous', () => {
    assert.equal(espaceMembreOuvert({ allowedProviderIds: ['salon-a'] }, 'salon-a'), true);
    assert.equal(espaceMembreOuvert({ enabledForAll: true, allowedProviderIds: [] }, 'salon-z'), true);
  });
});
