/**
 * Devises — table, correspondance pays et barème des frais.
 *
 * node --experimental-strip-types --test packages/shared/src/constants/currencies.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_CURRENCIES,
  SERVICE_FEE_BY_CURRENCY,
  DEFAULT_CURRENCY,
  getCurrencyForCountry,
  getCurrency,
  isSupportedCurrency,
} from './currencies.ts';

describe('getCurrencyForCountry', () => {
  it('la Suisse est le seul pays ouvert hors zone euro', () => {
    assert.equal(getCurrencyForCountry('CH'), 'CHF');
    for (const pays of ['FR', 'BE', 'LU', 'DE', 'ES', 'IT', 'NL', 'PT']) {
      assert.equal(getCurrencyForCountry(pays), 'EUR', pays);
    }
  });

  it('la casse du code pays n’a pas d’importance', () => {
    assert.equal(getCurrencyForCountry('ch'), 'CHF');
  });

  it('un pays inconnu retombe sur l’euro plutôt que de casser', () => {
    assert.equal(getCurrencyForCountry('ZZ'), 'EUR');
    assert.equal(getCurrencyForCountry(null), 'EUR');
    assert.equal(getCurrencyForCountry(undefined), 'EUR');
    assert.equal(getCurrencyForCountry(''), 'EUR');
  });
});

describe('table des devises', () => {
  it('AUCUNE devise sans décimale : tout le code divise par 100', () => {
    for (const d of SUPPORTED_CURRENCIES) {
      assert.equal(d.decimals, 2, `${d.code} casserait chaque prix affiché`);
    }
  });

  it('la devise par défaut est dans la table', () => {
    assert.equal(isSupportedCurrency(DEFAULT_CURRENCY), true);
  });

  it('les codes sont uniques et en trois lettres majuscules', () => {
    const codes = SUPPORTED_CURRENCIES.map((d) => d.code);
    assert.equal(new Set(codes).size, codes.length);
    for (const c of codes) assert.match(c, /^[A-Z]{3}$/);
  });

  it('une devise inconnue retombe sur l’euro', () => {
    assert.equal(getCurrency('XXX').code, 'EUR');
    assert.equal(getCurrency(null).code, 'EUR');
  });

  it('isSupportedCurrency accepte la minuscule', () => {
    assert.equal(isSupportedCurrency('chf'), true);
    assert.equal(isSupportedCurrency('XXX'), false);
    assert.equal(isSupportedCurrency(null), false);
  });
});

describe('barème des frais de service', () => {
  it('chaque devise de la table a son barème', () => {
    for (const d of SUPPORTED_CURRENCIES) {
      assert.ok(SERVICE_FEE_BY_CURRENCY[d.code], `barème manquant pour ${d.code}`);
    }
  });

  it('l’euro garde EXACTEMENT les valeurs d’avant (0,49 € dès 5 €)', () => {
    assert.deepEqual(SERVICE_FEE_BY_CURRENCY.EUR, { fee: 49, minDeposit: 500 });
  });

  it('des frais toujours inférieurs au seuil, sinon ils mangeraient l’acompte', () => {
    for (const [code, b] of Object.entries(SERVICE_FEE_BY_CURRENCY)) {
      assert.ok(b.fee > 0, code);
      assert.ok(b.fee < b.minDeposit, `${code} : frais >= seuil`);
    }
  });
});
