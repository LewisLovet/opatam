/**
 * Multidevise — la règle de résolution, les barèmes et les formateurs.
 *
 * Ce fichier couvre ce qui se teste SANS Stripe ni Firestore : quelle devise
 * pour quel montant, combien de frais, et comment le montant s'écrit. Les
 * parcours de paiement réels sont dans `scripts/devises/parcours-stripe.mjs`.
 *
 * node --experimental-strip-types --test \
 *   packages/shared/src/utils/devises-bout-en-bout.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_CURRENCIES,
  SERVICE_FEE_BY_CURRENCY,
  DEFAULT_CURRENCY,
  deviseDeLaReservation,
  clientServiceFee,
} from '../constants/currencies.ts';
import { formatPrice, formatPriceCompact } from './prix.ts';

const DEVISES = SUPPORTED_CURRENCIES.map((d) => d.code);

describe('la devise est FIGÉE sur la réservation', () => {
  it('une réservation avec devise commande, quoi que dise le prestataire', () => {
    // Le cas qui a motivé tout le chantier : un prestataire passe de l'euro au
    // franc, et un rendez-vous pris en euros se faisait débiter en francs.
    assert.equal(
      deviseDeLaReservation({ currency: 'EUR' }, { currency: 'CHF' }),
      'EUR',
    );
  });

  it('une réservation HISTORIQUE (sans devise) vaut l’euro', () => {
    // Surtout PAS la devise actuelle du prestataire : elle a pu changer depuis.
    assert.equal(
      deviseDeLaReservation({}, { currency: 'CHF' }),
      DEFAULT_CURRENCY,
    );
    assert.equal(
      deviseDeLaReservation({ currency: null }, { currency: 'GBP' }),
      DEFAULT_CURRENCY,
    );
  });

  it('avant toute réservation, c’est la devise du prestataire', () => {
    assert.equal(deviseDeLaReservation(null, { currency: 'CHF' }), 'CHF');
    assert.equal(deviseDeLaReservation(undefined, { currency: 'usd' }), 'USD');
  });

  it('sans rien du tout, l’euro', () => {
    assert.equal(deviseDeLaReservation(null, null), DEFAULT_CURRENCY);
    assert.equal(deviseDeLaReservation(undefined, undefined), DEFAULT_CURRENCY);
    assert.equal(deviseDeLaReservation(null, {}), DEFAULT_CURRENCY);
  });

  it('la casse n’a pas d’importance, la sortie est en majuscules', () => {
    assert.equal(deviseDeLaReservation({ currency: 'chf' }), 'CHF');
  });

  it('changer la devise du prestataire ne touche PAS les réservations prises', () => {
    const resa = { currency: 'CHF' };
    const avant = deviseDeLaReservation(resa, { currency: 'CHF' });
    // Le prestataire est déverrouillé par l'administration et passe à l'euro.
    const apres = deviseDeLaReservation(resa, { currency: 'EUR' });
    assert.equal(avant, 'CHF');
    assert.equal(apres, 'CHF', 'la réservation doit garder sa devise');
  });
});

describe('frais Opatam — les cinq barèmes et leurs seuils', () => {
  it('sous le seuil, aucun frais, dans chaque devise', () => {
    for (const devise of DEVISES) {
      const { minDeposit } = SERVICE_FEE_BY_CURRENCY[devise];
      assert.equal(clientServiceFee(minDeposit - 1, devise), 0, `${devise} juste sous le seuil`);
      assert.equal(clientServiceFee(0, devise), 0, `${devise} à zéro`);
    }
  });

  it('AU seuil, le forfait s’applique — la borne est inclusive', () => {
    for (const devise of DEVISES) {
      const { fee, minDeposit } = SERVICE_FEE_BY_CURRENCY[devise];
      assert.equal(clientServiceFee(minDeposit, devise), fee, `${devise} au seuil`);
    }
  });

  it('au-dessus du seuil, le forfait ne bouge plus', () => {
    for (const devise of DEVISES) {
      const { fee } = SERVICE_FEE_BY_CURRENCY[devise];
      assert.equal(clientServiceFee(10_000, devise), fee, devise);
      assert.equal(clientServiceFee(1_000_000, devise), fee, `${devise} sur un gros acompte`);
    }
  });

  it('l’EURO garde EXACTEMENT son comportement d’avant le chantier', () => {
    // Garde-fou de non-régression : la quasi-totalité des comptes est en euro.
    assert.equal(clientServiceFee(499), 0);
    assert.equal(clientServiceFee(500), 49);
    assert.equal(clientServiceFee(3500), 49);
  });

  it('une devise INCONNUE retombe sur le barème euro plutôt que de planter', () => {
    assert.equal(clientServiceFee(3500, 'XXX'), clientServiceFee(3500, 'EUR'));
    assert.equal(clientServiceFee(3500, undefined), clientServiceFee(3500, 'EUR'));
    assert.equal(clientServiceFee(3500, null), clientServiceFee(3500, 'EUR'));
  });

  it('les frais ne dépassent jamais l’acompte', () => {
    // Sinon la cliente paierait plus de frais que d'acompte.
    for (const devise of DEVISES) {
      for (const montant of [500, 700, 1000, 5000]) {
        const frais = clientServiceFee(montant, devise);
        assert.ok(frais <= montant, `${devise} : ${frais} > ${montant}`);
      }
    }
  });
});

describe('formateurs — le symbole et sa place', () => {
  it('chaque devise produit son propre symbole, jamais l’euro', () => {
    const rendus = DEVISES.map((d) => formatPrice(3500, d));
    assert.equal(new Set(rendus).size, DEVISES.length, `symboles non distincts : ${rendus}`);
    for (const [i, devise] of DEVISES.entries()) {
      if (devise === 'EUR') continue;
      assert.ok(!rendus[i].includes('€'), `${devise} rend un euro : ${rendus[i]}`);
    }
  });

  it('une devise absente ou nulle vaut l’euro — jamais une exception', () => {
    const euro = formatPrice(3500, 'EUR');
    assert.equal(formatPrice(3500, null), euro);
    assert.equal(formatPrice(3500, undefined), euro);
    assert.equal(formatPrice(3500, ''), euro);
  });

  it('LA PLACE du symbole suit la langue — c’est pourquoi il sort des chaînes', () => {
    // L'anglais écrit « €35.00 », le français « 35,00 € ». Une chaîne traduite
    // qui porte le symbole en dur ne peut pas rendre les deux.
    const fr = formatPrice(3500, 'EUR', 'fr-FR');
    const en = formatPrice(3500, 'EUR', 'en-GB');
    assert.ok(fr.trimEnd().endsWith('€'), `fr devrait finir par le symbole : ${fr}`);
    assert.ok(en.trimStart().startsWith('€'), `en devrait commencer par le symbole : ${en}`);
  });

  it('« $CA » et « $US » restent distingués — le choix est volontaire', () => {
    // `currencyDisplay: 'narrowSymbol'` rendrait « $ » pour les deux. Une
    // cliente sur le point d'être débitée doit savoir lequel.
    const cad = formatPrice(3500, 'CAD', 'fr-FR');
    const usd = formatPrice(3500, 'USD', 'fr-FR');
    assert.notEqual(cad, usd, 'le dollar canadien et l’américain doivent se distinguer');
  });

  it('zéro se traduit, dans les cinq langues', () => {
    assert.equal(formatPrice(0, 'CHF', 'fr-FR'), 'Gratuit');
    assert.equal(formatPrice(0, 'CHF', 'en-GB'), 'Free');
    assert.equal(formatPrice(0, 'CHF', 'it-IT'), 'Gratis');
    assert.equal(formatPrice(0, 'CHF', 'pt-PT'), 'Grátis');
    assert.equal(formatPrice(0, 'CHF', 'de-DE'), 'Kostenlos');
  });

  it('la forme compacte laisse tomber les décimales inutiles, pas le symbole', () => {
    for (const devise of DEVISES) {
      const rond = formatPriceCompact(12_000, devise, 'fr-FR');
      const virgule = formatPriceCompact(8950, devise, 'fr-FR');
      assert.ok(!/[.,]00/.test(rond), `${devise} : décimales inutiles dans ${rond}`);
      assert.ok(/[.,]50/.test(virgule), `${devise} : décimales perdues dans ${virgule}`);
      assert.ok(/\d/.test(rond) && rond.replace(/[\d\s .,]/g, '').length > 0,
        `${devise} : symbole absent de ${rond}`);
    }
  });

  it('la forme compacte ne dit PAS « Gratuit » à zéro', () => {
    // Ses appelants traitent zéro comme « pas de montant » et n'affichent rien.
    assert.notEqual(formatPriceCompact(0, 'EUR', 'fr-FR'), 'Gratuit');
  });
});

describe('statistiques — jamais de total entre deux devises', () => {
  /**
   * Ce que fait l'agrégation de l'administration : un seau PAR devise. La
   * fonction est reproduite ici parce que la vraie vit dans une route Next,
   * mais c'est la règle qui est testée, pas son emplacement.
   */
  function grouper(lignes) {
    const parDevise = {};
    for (const l of lignes) {
      const d = (l.currency ?? DEFAULT_CURRENCY).toUpperCase();
      parDevise[d] = (parDevise[d] ?? 0) + l.amount;
    }
    return parDevise;
  }

  it('49 EUR + 50 CHF ne font pas 99 : ce sont deux seaux', () => {
    const r = grouper([
      { amount: 49, currency: 'EUR' },
      { amount: 50, currency: 'CHF' },
    ]);
    assert.deepEqual(r, { EUR: 49, CHF: 50 });
    assert.equal(Object.values(r).length, 2, 'un total unique serait un chiffre inventé');
  });

  it('une ligne sans devise rejoint l’euro, pas un seau « inconnu »', () => {
    assert.deepEqual(grouper([{ amount: 49 }, { amount: 49, currency: 'EUR' }]), { EUR: 98 });
  });

  it('la casse ne crée pas deux seaux pour une même devise', () => {
    assert.deepEqual(
      grouper([{ amount: 10, currency: 'chf' }, { amount: 5, currency: 'CHF' }]),
      { CHF: 15 },
    );
  });
});
