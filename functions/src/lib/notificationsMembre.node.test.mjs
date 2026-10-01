/**
 * Notifications de l'espace membre — qui est prévenu de quoi.
 *   node --experimental-strip-types --test functions/src/lib/notificationsMembre.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); }
    catch (e) {
      if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context);
      throw e;
    }
  }
`));
const { notifMembreActivee, acteurDeLEcriture, membrePrevenu, gerantPrevenu, TEXTES_MEMBRE, extrait } = await import('./notificationsMembre.ts');

const ts = (ms) => ({ toMillis: () => ms });

describe('réglages du membre', () => {
  it('absent = activé ; coupé type par type', () => {
    assert.equal(notifMembreActivee(undefined, 'rendezVous'), true);
    assert.equal(notifMembreActivee({ espaceMembre: { rappels: false } }, 'rappels'), false);
    assert.equal(notifMembreActivee({ espaceMembre: { rappels: false } }, 'avis'), true);
  });
});

describe('qui a fait l’action', () => {
  it('création : l’auteur posé avec le document', () => {
    assert.equal(acteurDeLEcriture(null, { proActor: 'member', proActorAt: ts(1) }), 'member');
    assert.equal(acteurDeLEcriture(null, {}), null);
  });
  it('mise à jour par le pro : l’horodatage a bougé', () => {
    assert.equal(acteurDeLEcriture({ proActor: 'owner', proActorAt: ts(1) }, { proActor: 'member', proActorAt: ts(2) }), 'member');
  });
  it('mise à jour par la cliente : l’auteur de la création ne compte plus', () => {
    assert.equal(acteurDeLEcriture({ proActor: 'member', proActorAt: ts(1) }, { proActor: 'member', proActorAt: ts(1) }), null);
  });
  it('le membre n’est jamais prévenu de sa propre action', () => {
    assert.equal(membrePrevenu('member'), false);
    assert.equal(membrePrevenu('owner'), true);
    assert.equal(membrePrevenu(null), true);
  });
});

describe('le gérant', () => {
  it('toujours pour ses propres rendez-vous', () => {
    assert.equal(gerantPrevenu({ rdvDuGerant: true, preferences: { teamBookingNotifications: false } }), true);
  });
  it('l’équipe : par défaut oui, sauf interrupteur coupé', () => {
    assert.equal(gerantPrevenu({ rdvDuGerant: false, preferences: undefined }), true);
    assert.equal(gerantPrevenu({ rdvDuGerant: false, preferences: { teamBookingNotifications: false } }), false);
  });
});

describe('textes', () => {
  it('cinq langues, complètes', () => {
    for (const t of Object.values(TEXTES_MEMBRE)) {
      assert.ok(t.annuleParSalon('Léa', 'lundi').includes('Léa'));
      assert.ok(t.deplaceVers('Léa', 'Coupe', 'mardi').includes('mardi'));
      assert.ok(t.avisCorps('Léa', 5, null).includes('5/5'));
      assert.ok(t.avisCorps('Léa', 4, 'Top').includes('Top'));
      assert.notEqual(t.planningModifieCorps(1), t.planningModifieCorps(3));
    }
  });
  it('extrait de commentaire : 80 caractères au plus', () => {
    assert.equal(extrait('  '), null);
    assert.equal(extrait('a'.repeat(100)).length, 81);
  });
});
