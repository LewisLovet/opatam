import { describe, it, expect } from 'vitest';
import {
  resolveDeposit,
  combineResolvedDeposits,
  isDepositRefundable,
  parseRefundDeadlineHours,
} from '@booking-app/shared';
import { isWithinRefundDeadline } from './refund-deadline';

/**
 * Politique de remboursement des acomptes — le zéro est une VALEUR, pas une
 * absence. Chaque cas ancre un maillon de la chaîne : résolution par
 * prestation, combinaison multi-prestations (règle « le délai le plus
 * favorable à la cliente »), décision d'annulation, et les primitives des
 * formulaires (toggle « Acompte remboursable »).
 *
 * Le bug d'origine : `refundDeadlineHours || 24` transformait « toutes les
 * prestations non remboursables » en « remboursable 24 h ».
 */

const settingsAvecDefaut = (hours: number) => ({
  depositDefault: { percent: 30, refundDeadlineHours: hours },
});

describe('resolveDeposit — le 0 survit', () => {
  it("acompte GLOBAL non remboursable (0 h) → l'acompte résolu porte 0", () => {
    const d = resolveDeposit({ price: 4000, deposit: null }, settingsAvecDefaut(0));
    expect(d?.amount).toBe(1200);
    expect(d?.refundDeadlineHours).toBe(0);
    expect(d?.source).toBe('default');
  });

  it('acompte PERSONNALISÉ non remboursable (0 h) → 0 conservé', () => {
    const d = resolveDeposit(
      { price: 4000, deposit: { type: 'percent', value: 50, refundDeadlineHours: 0 } },
      settingsAvecDefaut(24),
    );
    expect(d?.amount).toBe(2000);
    expect(d?.refundDeadlineHours).toBe(0);
    expect(d?.source).toBe('service');
  });

  it('délai 24 → reste 24 (aucune régression)', () => {
    const d = resolveDeposit(
      { price: 4000, deposit: { type: 'fixed', value: 1500, refundDeadlineHours: 24 } },
      {},
    );
    expect(d?.refundDeadlineHours).toBe(24);
  });

  it("mode none → jamais d'acompte, même avec un défaut global", () => {
    const d = resolveDeposit({ price: 4000, deposit: { type: 'none' } }, settingsAvecDefaut(24));
    expect(d).toBe(null);
  });
});

describe('combineResolvedDeposits — la règle multi-prestations', () => {
  it('0 h + 48 h → 48 h (le plus favorable à la cliente), montants additionnés', () => {
    const c = combineResolvedDeposits([
      { amount: 1000, refundDeadlineHours: 0 },
      { amount: 2000, refundDeadlineHours: 48 },
    ]);
    expect(c?.amount).toBe(3000);
    expect(c?.refundDeadlineHours).toBe(48);
  });

  it('0 h + 0 h → 0 h EXACTEMENT (le bug || 24 donnait 24)', () => {
    const c = combineResolvedDeposits([
      { amount: 1000, refundDeadlineHours: 0 },
      { amount: 500, refundDeadlineHours: 0 },
    ]);
    expect(c?.amount).toBe(1500);
    expect(c?.refundDeadlineHours).toBe(0);
  });

  it('une seule prestation à 0 h → 0 h', () => {
    const c = combineResolvedDeposits([{ amount: 1200, refundDeadlineHours: 0 }]);
    expect(c?.refundDeadlineHours).toBe(0);
  });

  it('aucun acompte → null (pas de pending_payment fantôme)', () => {
    expect(combineResolvedDeposits([])).toBe(null);
  });
});

describe('annulation — aucun remboursement automatique quand 0', () => {
  const dansTroisJours = new Date(Date.now() + 3 * 86_400_000);

  it("0 h → pas de remboursement automatique, même très en avance", () => {
    expect(isWithinRefundDeadline(dansTroisJours, 0)).toBe(false);
  });

  it('24 h → remboursé si annulation avant la fenêtre…', () => {
    expect(isWithinRefundDeadline(dansTroisJours, 24)).toBe(true);
  });

  it("…mais pas dans la fenêtre", () => {
    const dansDeuxHeures = new Date(Date.now() + 2 * 3_600_000);
    expect(isWithinRefundDeadline(dansDeuxHeures, 24)).toBe(false);
  });
});

describe('formulaires — hydratation et sérialisation du toggle', () => {
  it('hydratation : 0 stocké → toggle éteint ; 24 → allumé ; absent (historique) → allumé', () => {
    expect(isDepositRefundable(0)).toBe(false);
    expect(isDepositRefundable(24)).toBe(true);
    expect(isDepositRefundable(undefined)).toBe(true);
  });

  it("saisie : 0 CONSERVÉ, bornes 0–720 respectées, l'invalide signalé (null) au lieu d'être maquillé en 24", () => {
    expect(parseRefundDeadlineHours('0')).toBe(0);
    expect(parseRefundDeadlineHours(0)).toBe(0);
    expect(parseRefundDeadlineHours('24')).toBe(24);
    expect(parseRefundDeadlineHours('720')).toBe(720);
    expect(parseRefundDeadlineHours('721')).toBe(null);
    expect(parseRefundDeadlineHours('')).toBe(null);
    expect(parseRefundDeadlineHours('abc')).toBe(null);
    expect(parseRefundDeadlineHours(null)).toBe(null);
  });
});
