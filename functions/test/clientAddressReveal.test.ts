import { describe, it, expect } from 'vitest';
import { isClientAddressRevealed } from '../src/utils/clientAddressReveal';

/**
 * Test JUMEAU de packages/shared/src/utils/travel.test.ts (bloc
 * isClientAddressRevealed) — la fonction existe en double (functions
 * n'importe pas le package partagé) ; ce test verrouille la parité du
 * miroir. Toute divergence de table de statuts doit être répercutée des
 * deux côtés.
 */
describe('isClientAddressRevealed (miroir functions)', () => {
  it('confirmed et completed → adresse visible du pro', () => {
    expect(isClientAddressRevealed({ status: 'confirmed' })).toBe(true);
    expect(isClientAddressRevealed({ status: 'completed' })).toBe(true);
  });

  it('pending, pending_payment, cancelled, noshow → ville seule', () => {
    expect(isClientAddressRevealed({ status: 'pending' })).toBe(false);
    expect(isClientAddressRevealed({ status: 'pending_payment' })).toBe(false);
    expect(isClientAddressRevealed({ status: 'cancelled' })).toBe(false);
    expect(isClientAddressRevealed({ status: 'noshow' })).toBe(false);
  });
});
