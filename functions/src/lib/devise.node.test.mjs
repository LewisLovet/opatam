/**
 * Le miroir de `functions` doit rendre EXACTEMENT comme `shared`.
 *
 * Les functions ne peuvent pas importer `@booking-app/shared` à l'exécution :
 * `firebase deploy` échoue sur ses sources ESM. `functions/src/lib/devise.ts`
 * est donc une copie — et une copie dérive. Ce test la confronte à l'original
 * pour les cinq devises et les cinq langues.
 *
 * node --experimental-strip-types --test functions/src/lib/devise.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatMontant, formatMontantCompact } from './devise.ts';
import {
  formatPrice,
  formatPriceCompact,
} from '../../../packages/shared/src/utils/prix.ts';

const DEVISES = ['EUR', 'CHF', 'GBP', 'USD', 'CAD'];
// Langue de l'application → locale Intl, telle que `shared` la reçoit.
const LANGUES = {
  fr: 'fr-FR',
  en: 'en-GB',
  it: 'it-IT',
  pt: 'pt-PT',
  de: 'de-DE',
};
const MONTANTS = [500, 3500, 8950, 12_000, 1_000_000];

describe('formatMontant ≡ formatPrice', () => {
  it('rend la même chose pour chaque devise × langue × montant', () => {
    for (const devise of DEVISES) {
      for (const [langue, intl] of Object.entries(LANGUES)) {
        for (const cents of MONTANTS) {
          assert.equal(
            formatMontant(cents, devise, langue),
            formatPrice(cents, devise, intl),
            `${devise} / ${langue} / ${cents}`,
          );
        }
      }
    }
  });

  it('une devise absente vaut l’euro des deux côtés', () => {
    assert.equal(formatMontant(3500, null, 'fr'), formatPrice(3500, null, 'fr-FR'));
    assert.equal(formatMontant(3500, undefined, 'fr'), formatPrice(3500, undefined, 'fr-FR'));
  });

  it('une langue inconnue retombe sur le français, pas sur une exception', () => {
    assert.equal(formatMontant(3500, 'CHF', 'xx'), formatPrice(3500, 'CHF', 'fr-FR'));
    assert.equal(formatMontant(3500, 'CHF', null), formatPrice(3500, 'CHF', 'fr-FR'));
  });

  it('une langue régionalisée (« en-US ») est acceptée', () => {
    // Les locales stockées sur les réservations sont parfois « fr-FR ».
    assert.equal(formatMontant(3500, 'EUR', 'fr-FR'), formatPrice(3500, 'EUR', 'fr-FR'));
  });
});

describe('formatMontantCompact ≡ formatPriceCompact', () => {
  it('rend la même chose pour chaque devise × langue × montant', () => {
    for (const devise of DEVISES) {
      for (const [langue, intl] of Object.entries(LANGUES)) {
        for (const cents of MONTANTS) {
          assert.equal(
            formatMontantCompact(cents, devise, langue),
            formatPriceCompact(cents, devise, intl),
            `${devise} / ${langue} / ${cents}`,
          );
        }
      }
    }
  });

  it('les décimales inutiles tombent, le symbole reste', () => {
    // C'est ce que faisaient les formateurs locaux des notifications, avec
    // « € » écrit à la main.
    assert.equal(formatMontantCompact(3000, 'EUR', 'fr'), formatPrice(3000, 'EUR', 'fr-FR').replace(',00', ''));
    assert.ok(formatMontantCompact(3000, 'CHF', 'fr').includes('CHF'));
  });

  it('zéro n’est PAS « Gratuit » côté functions non plus', () => {
    // Les appelants (push, e-mails) ne l'appellent que sur un acompte payé.
    assert.notEqual(formatMontantCompact(0, 'EUR', 'fr'), 'Gratuit');
  });
});
