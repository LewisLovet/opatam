/**
 * Rappel « semaine prochaine vide » — quand l'envoyer, quelle semaine, et
 * quand une semaine est vide.
 *   node --experimental-strip-types --test functions/src/lib/rappelPlanning.node.test.mjs
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
const { momentDuRappel, lundiSuivant, semaineVide, cleDuRappel, TEXTES_RAPPEL, jourLisible } = await import('./rappelPlanning.ts');

describe('quand envoyer', () => {
  it('jeudi 18 h à Paris (16 h UTC en heure d’été) → « jeudi »', () => {
    assert.equal(momentDuRappel(new Date('2026-10-01T16:00:00Z'), 'Europe/Paris'), 'jeudi');
    assert.equal(momentDuRappel(new Date('2026-10-01T16:59:00Z'), 'Europe/Paris'), 'jeudi');
  });
  it('17 h ou 19 h : rien ; un autre jour à 18 h : rien', () => {
    assert.equal(momentDuRappel(new Date('2026-10-01T15:00:00Z'), 'Europe/Paris'), null);
    assert.equal(momentDuRappel(new Date('2026-10-01T17:00:00Z'), 'Europe/Paris'), null);
    assert.equal(momentDuRappel(new Date('2026-09-30T16:00:00Z'), 'Europe/Paris'), null);
  });
  it('dimanche 18 h → « dimanche »', () => {
    assert.equal(momentDuRappel(new Date('2026-10-04T16:00:00Z'), 'Europe/Paris'), 'dimanche');
  });
  it('à l’heure DU LIEU : La Réunion (UTC+4) reçoit le sien à 14 h UTC', () => {
    assert.equal(momentDuRappel(new Date('2026-10-01T14:00:00Z'), 'Indian/Reunion'), 'jeudi');
    assert.equal(momentDuRappel(new Date('2026-10-01T16:00:00Z'), 'Indian/Reunion'), null);
  });
});

describe('quelle semaine', () => {
  it('le lundi qui suit, jeudi comme dimanche', () => {
    assert.equal(lundiSuivant('2026-10-01'), '2026-10-05'); // jeudi
    assert.equal(lundiSuivant('2026-10-04'), '2026-10-05'); // dimanche
    assert.equal(lundiSuivant('2026-10-05'), '2026-10-12'); // lundi → le suivant
  });
});

describe('semaine vide', () => {
  const lundi = '2026-10-05';
  const r = (x) => ({ weekdays: [], slots: [], createdAt: 1, ...x });
  it('aucun réglage → vide', () => assert.equal(semaineVide([], lundi), true));
  it('un jour ouvert dans la semaine → pas vide', () => {
    assert.equal(semaineVide([r({ from: '2026-10-08', to: '2026-10-08', mode: 'slots', slots: [{ start: '14:00', end: '22:00' }] })], lundi), false);
  });
  it('ouvert la semaine d’APRÈS seulement → vide', () => {
    assert.equal(semaineVide([r({ from: '2026-10-12', to: '2026-10-12', mode: 'slots', slots: [{ start: '14:00', end: '22:00' }] })], lundi), true);
  });
  it('« fermé » par-dessus une ouverture plus ancienne → vide', () => {
    const ouvert = r({ from: '2026-10-05', to: '2026-10-11', mode: 'slots', slots: [{ start: '09:00', end: '18:00' }], createdAt: 1 });
    const ferme = r({ from: '2026-10-05', to: '2026-10-11', mode: 'closed', createdAt: 2 });
    assert.equal(semaineVide([ouvert, ferme], lundi), true);
  });
  it('« horaires habituels » = fermé pour un membre en horaires variables', () => {
    assert.equal(semaineVide([r({ from: '2026-10-05', to: '2026-10-11', mode: 'usual' })], lundi), true);
  });
});

describe('textes et marqueur', () => {
  it('un marqueur par salon, destinataire, semaine et moment', () => {
    assert.equal(cleDuRappel('p1', 'm1', '2026-10-05', 'jeudi'), 'p1_m1_2026-10-05_jeudi');
  });
  it('cinq langues, singulier et pluriel', () => {
    for (const t of Object.values(TEXTES_RAPPEL)) {
      assert.ok(t.membreTitre('5', false) && t.membreTitre('5', true) !== t.membreTitre('5', false));
      assert.notEqual(t.gerantTitre(1, '5'), t.gerantTitre(2, '5'));
      assert.ok(t.membreCorps('5', '11').length > 10 && t.gerantCorps('Léon').includes('Léon'));
    }
    assert.equal(jourLisible('2026-10-05', 'fr-FR'), '5 octobre');
  });
});
