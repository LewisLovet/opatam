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
  peutChangerDevise,
  raisonVerrouDevise,
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

describe('périmètre : une devise doit être encaissable', () => {
  // Stripe n'opère pas partout (stripe.com/global). Offrir une devise dont
  // le pays n'a pas de Stripe, c'est promettre des acomptes qu'on ne pourra
  // jamais verser. Le dirham marocain a été retiré pour cette raison.
  it('le dirham marocain n’est PLUS proposé : le Maroc n’est pas un pays Stripe', () => {
    assert.equal(isSupportedCurrency('MAD'), false);
    assert.equal(SERVICE_FEE_BY_CURRENCY.MAD, undefined);
    assert.equal(
      SUPPORTED_CURRENCIES.some((d) => d.code === 'MAD'),
      false,
    );
  });

  it('le Maroc ne propose donc aucune devise et retombe sur l’euro', () => {
    assert.equal(getCurrencyForCountry('MA'), 'EUR');
  });

  it('les cinq devises restantes sont celles de pays où Stripe opère', () => {
    assert.deepEqual(
      SUPPORTED_CURRENCIES.map((d) => d.code),
      ['EUR', 'CHF', 'GBP', 'USD', 'CAD'],
    );
  });

  it('chaque seuil dépasse le minimum de paiement Stripe de sa devise', () => {
    // docs.stripe.com/currencies — montant débité minimum par devise.
    const minimumStripe = { EUR: 50, CHF: 50, GBP: 30, USD: 50, CAD: 50 };
    for (const [code, bareme] of Object.entries(SERVICE_FEE_BY_CURRENCY)) {
      const plancher = minimumStripe[code];
      assert.ok(plancher !== undefined, `minimum Stripe inconnu pour ${code}`);
      assert.ok(
        bareme.minDeposit > plancher,
        `${code} : un acompte au seuil serait refusé par Stripe`,
      );
    }
  });
});

describe('verrou de la devise', () => {
  // Le verrou tient au premier PAIEMENT, pas à la connexion de Stripe :
  // presque tous les comptes existants ont déjà branché Stripe, donc
  // verrouiller là-dessus les figerait tous sur l'euro.
  it('un prestataire sans encaissement peut choisir', () => {
    assert.equal(peutChangerDevise({}), true);
    assert.equal(peutChangerDevise({ currencyLockedAt: null }), true);
    assert.equal(peutChangerDevise({ currencyLockedAt: undefined }), true);
  });

  it('les comptes d’AVANT la fonctionnalité gardent leur choix', () => {
    // Le champ n'existe pas en base : ils ne doivent pas être verrouillés
    // par accident, sinon la fonctionnalité ne sert personne.
    assert.equal(peutChangerDevise({ currency: 'EUR', businessName: 'Ancien' }), true);
  });

  it('un acompte encaissé ferme le choix', () => {
    assert.equal(peutChangerDevise({ currencyLockedAt: new Date() }), false);
    assert.equal(raisonVerrouDevise({ currencyLockedAt: new Date() }), 'paiement_encaisse');
  });

  it('un prestataire absent ne fait pas planter la garde', () => {
    assert.equal(peutChangerDevise(null), true);
    assert.equal(peutChangerDevise(undefined), true);
    assert.equal(raisonVerrouDevise(null), null);
  });
});
