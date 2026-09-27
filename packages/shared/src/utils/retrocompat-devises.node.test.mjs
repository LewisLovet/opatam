/**
 * Rétrocompatibilité multidevise — les cas de régression obligatoires.
 *
 *   1. prestataire historique sans devise : tout reste en EUR ;
 *   2. ancienne réservation sans devise : détail, e-mail, remboursement en EUR ;
 *   5. historique EUR puis réservations CHF : aucun total EUR + CHF ;
 *   6. prestataire ayant déjà encaissé : changement de devise refusé ;
 *   7. stories, fidélité et écran des acomptes lisent la devise du pro connecté.
 *
 * Les cas 3 (ancien acompte mobile → remboursement plateforme) et 4 (parcours
 * CHF complet) sont des parcours Stripe RÉELS : `scripts/devises/parcours-
 * stripe.mjs` (scénario RÉTROCOMPAT) et `parcours-chf-complet.mjs`.
 *
 * node --experimental-strip-types --test packages/shared/src/utils/retrocompat-devises.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deviseDeLaReservation, peutChangerDevise, DEFAULT_CURRENCY } from '../constants/currencies.ts';
import { formatPrice } from './prix.ts';
import { revenueByCurrencyFromDailies, activityRevenueByCurrencyFromDailies, autresDevises, totalsFromDailies, trendFromDailies } from './statsAggregate.ts';

const ancien = { businessName: 'Salon d’avant', settings: {} }; // pas de `currency`

describe('1. prestataire historique sans devise', () => {
  it('ses prix se résolvent en EUR', () => {
    assert.equal(deviseDeLaReservation(null, ancien), DEFAULT_CURRENCY);
    assert.equal(formatPrice(3500, ancien.currency), formatPrice(3500, 'EUR'));
  });

  it('il reste LIBRE de choisir : aucun verrou n’existe sur son compte', () => {
    assert.equal(peutChangerDevise(ancien), true);
  });
});

describe('2. ancienne réservation sans devise', () => {
  const vieilleResa = { price: 3500, deposit: { amount: 1000, status: 'paid', connectAccountId: null } };

  it('son détail et ses e-mails restent en EUR, même si le pro est passé en CHF depuis', () => {
    assert.equal(deviseDeLaReservation(vieilleResa, { currency: 'CHF' }), 'EUR');
    assert.equal(formatPrice(vieilleResa.price, deviseDeLaReservation(vieilleResa)), formatPrice(3500, 'EUR'));
  });

  it('son remboursement part sur la PLATEFORME : connectAccountId est nul', () => {
    // Règle de `refund-deposit.ts` : en-tête Stripe-Account seulement si le
    // champ est renseigné. Reproduite ici parce qu'elle n'est pas importable
    // (firebase-admin) ; le parcours Stripe réel RÉTROCOMPAT l'exécute.
    const options = vieilleResa.deposit.connectAccountId
      ? { stripeAccount: vieilleResa.deposit.connectAccountId }
      : undefined;
    assert.equal(options, undefined);
  });
});

describe('5. historique EUR puis réservations CHF : aucun total mélangé', () => {
  // Trois docs jour : deux d'AVANT le multidevise (pas de seaux, donc EUR),
  // un d'après, écrit pour un pro passé au CHF (référence CHF).
  const dailies = [
    { revenue: 5000 },
    { revenue: 3000 },
    { revenue: 4000, revenueByCurrency: { CHF: 4000 } },
  ];

  it('les seaux séparent EUR et CHF', () => {
    assert.deepEqual(revenueByCurrencyFromDailies(dailies), { EUR: 8000, CHF: 4000 });
  });

  it('aucune clé ne vaut 12 000 : la somme EUR + CHF n’existe nulle part', () => {
    const t = totalsFromDailies(dailies.map((d) => ({
      ...d, bookingsCount: 1, confirmedCount: 1, cancelledCount: 0, noshowCount: 0,
      activityRevenue: 0, activityCount: 0, clientHashes: [], newClientHashes: [],
    })));
    for (const v of Object.values(t.revenueByCurrency)) assert.notEqual(v, 12_000);
    assert.equal(Object.keys(t.revenueByCurrency).length, 2);
  });

  it('l’écran affiche les autres devises À PART, sans la référence', () => {
    assert.deepEqual(autresDevises({ EUR: 8000, CHF: 4000 }, 'CHF'), [{ devise: 'EUR', montant: 8000 }]);
    assert.deepEqual(autresDevises({ EUR: 8000, CHF: 4000 }, 'EUR'), [{ devise: 'CHF', montant: 4000 }]);
  });

  it('une seule devise → rien à afficher à part : interface identique', () => {
    assert.deepEqual(autresDevises({ EUR: 8000 }, 'EUR'), []);
    assert.deepEqual(autresDevises(undefined, 'EUR'), []);
  });

  it('les compteurs non monétaires, eux, s’additionnent', () => {
    const t = totalsFromDailies(dailies.map((d) => ({
      ...d, bookingsCount: 2, confirmedCount: 1, cancelledCount: 0, noshowCount: 0,
      activityRevenue: 0, activityCount: 0, clientHashes: [], newClientHashes: [],
    })));
    assert.equal(t.bookingsCount, 6);
  });
});

describe('6. prestataire ayant déjà encaissé', () => {
  it('le changement de devise est REFUSÉ dès que le verrou existe', () => {
    assert.equal(peutChangerDevise({ currency: 'EUR', currencyLockedAt: new Date('2026-03-01') }), false);
  });

  it('un compte migré (verrou daté du premier encaissement) est refusé comme les autres', () => {
    // C'est ce que pose `scripts/devises/migration-verrou-devise.mjs`.
    assert.equal(peutChangerDevise({ currencyLockedAt: new Date('2025-11-14T10:00:00Z') }), false);
  });

  it('le déverrouillage administré (champ remis à null) rend le choix', () => {
    assert.equal(peutChangerDevise({ currency: 'CHF', currencyLockedAt: null }), true);
  });
});

describe('7. stories, fidélité et acomptes lisent la devise du pro connecté', () => {
  const racine = new URL('../../../../', import.meta.url).pathname;
  const surfaces = {
    'stories (prix et prix barré)': 'apps/mobile/components/StoryShare/StoryShareModal.tsx',
    'écran des acomptes (total encaissé)': 'apps/mobile/app/(pro)/payments.tsx',
    'fiche cliente (récompense fidélité)': 'apps/mobile/app/(pro)/client-detail/[key].tsx',
  };
  for (const [nom, chemin] of Object.entries(surfaces)) {
    it(`${nom} : devisePro() présent, plus aucun formatPrice(…, 'EUR')`, () => {
      const src = readFileSync(racine + chemin, 'utf8');
      assert.ok(src.includes('devisePro()'), `${chemin} n’appelle pas devisePro()`);
      assert.ok(!/formatPrice\([^)]*,\s*'EUR'/.test(src), `${chemin} force encore 'EUR' dans formatPrice`);
      assert.ok(!/currency:\s*'EUR'/.test(src), `${chemin} force encore currency: 'EUR'`);
    });
  }
});

describe('2 bis. affichage juste AVANT tout recalcul (devise de référence)', () => {
  // Un daily d'AVANT le multidevise : `revenue` en euros, pas de seaux.
  const legacy = [{ revenue: 8000, bookingsCount: 1, confirmedCount: 1, cancelledCount: 0, noshowCount: 0,
    activityRevenue: 1500, activityCount: 1, clientHashes: [], newClientHashes: [] }];

  it('sous une référence CHF, un ancien montant EUR n’est PAS affiché comme du CHF', () => {
    const t = totalsFromDailies(legacy, 'CHF');
    assert.equal(t.revenue, 0, 'le CA principal (CHF) doit être nul');
    assert.deepEqual(t.revenueByCurrency, { EUR: 8000 }, 'et l’euro apparaît dans SA ligne, une seule fois');
    assert.equal(t.activityRevenue, 0);
    assert.deepEqual(t.activityRevenueByCurrency, { EUR: 1500 });
  });

  it('sous une référence EUR, rien ne change pour les comptes existants', () => {
    const t = totalsFromDailies(legacy, 'EUR');
    assert.equal(t.revenue, 8000);
    assert.equal(t.activityRevenue, 1500);
    assert.deepEqual(autresDevises(t.revenueByCurrency, 'EUR'), []);
  });

  it('sans référence, l’ancien comportement (champs plats) est conservé', () => {
    assert.equal(totalsFromDailies(legacy).revenue, 8000);
  });
});

describe('3. activités payantes : devise figée, jamais additionnées', () => {
  it('une activité EUR d’avant et une activité CHF d’après restent séparées', () => {
    const docs = [
      { activityRevenue: 2000 },                                        // avant : pas de seaux → EUR
      { activityRevenue: 3000, activityRevenueByCurrency: { CHF: 3000 } },
    ];
    assert.deepEqual(activityRevenueByCurrencyFromDailies(docs), { EUR: 2000, CHF: 3000 });
    for (const v of Object.values(activityRevenueByCurrencyFromDailies(docs))) assert.notEqual(v, 5000);
  });

  it('un montant nul ne crée pas de ligne', () => {
    assert.deepEqual(activityRevenueByCurrencyFromDailies([{ activityRevenue: 0 }]), {});
  });
});

describe('2 ter. la courbe de tendance suit la devise de référence', () => {
  const dailies = [
    { date: '2026-09-01', revenue: 8000, bookingsCount: 2 },                                   // avant : EUR
    { date: '2026-09-02', revenue: 4000, revenueByCurrency: { CHF: 4000 }, bookingsCount: 1 }, // après : CHF
  ];
  it('sous référence CHF, le jour historique EUR pèse 0 — pas 8000 francs', () => {
    const pts = trendFromDailies(dailies, 'CHF');
    assert.equal(pts[0].revenue, 0);
    assert.equal(pts[1].revenue, 4000);
  });
  it('sous référence EUR, la courbe des comptes existants ne change pas', () => {
    assert.deepEqual(trendFromDailies(dailies, 'EUR').map((p) => p.revenue), [8000, 0]);
  });
  it('sans référence, ancien comportement (champ plat)', () => {
    assert.deepEqual(trendFromDailies(dailies).map((p) => p.revenue), [8000, 4000]);
  });
});
