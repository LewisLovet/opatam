/**
 * Codes d'accès au planning — les décisions du rangement.
 *
 * Partagées par le trigger `onMemberWriteAccessCode` et la migration : un
 * code trouvé dans une fiche membre (publique) part dans
 * `memberAccessCodes/{code}` (privé). Ces tests figent QUI garde un code
 * quand deux membres le revendiquent, et ce qui passe pour un code.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FORMAT_CODE, codeParMembre, decider, genererCode, normaliserCode } from './codesAccesRegles.ts';

describe('ce qui passe pour un code', () => {
  it('accepte les codes générés et les anciens, casse et espaces corrigés', () => {
    assert.equal(normaliserCode('JEAN-AB12'), 'JEAN-AB12');
    assert.equal(normaliserCode('  jean-ab12 '), 'JEAN-AB12');
    assert.equal(normaliserCode('-AB12'), '-AB12', 'ancien code d’un prénom sans lettre latine');
    assert.equal(normaliserCode('MARIE-0O1I'), 'MARIE-0O1I', 'anciens outils de démo : base 36');
  });
  it('refuse ce qui sortirait du document : slash, point, vide, trop long', () => {
    for (const brut of ['A/B', '../x', 'A.B', '', ' ', 'X', 'A'.repeat(25), null, 42, {}]) {
      assert.equal(normaliserCode(brut), null, JSON.stringify(brut));
    }
  });
});

describe('génération', () => {
  it('PRENOM-XXXX, sans accents, sans caractères ambigus', () => {
    const code = genererCode('Éloïse Martin', 4, () => 0);
    assert.equal(code, 'ELOISE-AAAA');
    for (let i = 0; i < 200; i++) {
      const c = genererCode('Jean', 4);
      assert.match(c, /^JEAN-[A-HJ-NP-Z2-9]{4}$/);
      assert.ok(FORMAT_CODE.test(c));
    }
  });
  it('un prénom sans lettre latine reçoit « MEMBRE », jamais un code qui commence par un tiret', () => {
    assert.match(genererCode('李娜'), /^MEMBRE-/);
    assert.match(genererCode(''), /^MEMBRE-/);
    assert.match(genererCode(undefined), /^MEMBRE-/);
  });
  it('la longueur demandée est tenue', () => {
    assert.match(genererCode('Ana', 6), /^ANA-[A-Z2-9]{6}$/);
  });
});

describe('qui garde un code', () => {
  const P = 'salon-1';
  const M = 'membre-1';
  it('libre → on le range', () => {
    assert.equal(decider('JEAN-AB12', null, P, M), 'ranger');
  });
  it('déjà rangé pour CE membre → rien à créer (migration relancée, trigger rejoué)', () => {
    assert.equal(decider('JEAN-AB12', { providerId: P, memberId: M }, P, M), 'deja-range');
  });
  it('pris par un autre membre, même salon ou autre salon → collision : ce membre reçoit un code neuf', () => {
    assert.equal(decider('JEAN-AB12', { providerId: P, memberId: 'membre-2' }, P, M), 'collision');
    assert.equal(decider('JEAN-AB12', { providerId: 'salon-2', memberId: M }, P, M), 'collision');
  });
  it('illisible comme code → code neuf aussi', () => {
    assert.equal(decider('A/B', null, P, M), 'invalide');
    assert.equal(decider(42, null, P, M), 'invalide');
  });
});

describe('le code de chaque membre', () => {
  it('le plus récent gagne ; les entrées sans membre sont ignorées', () => {
    const codes = codeParMembre([
      { code: 'A-1111', memberId: 'm1', creeLe: 1 },
      { code: 'A-2222', memberId: 'm1', creeLe: 5 },
      { code: 'B-1111', memberId: 'm2', creeLe: 3 },
      { code: 'X-0000', memberId: undefined, creeLe: 9 },
    ]);
    assert.deepEqual([...codes].sort(), [['m1', 'A-2222'], ['m2', 'B-1111']]);
  });
});
