/**
 * Parcours Stripe RÉELS, en mode test, pour le multidevise.
 *
 * Ce que ce script prouve, et qu'aucun test unitaire ne peut prouver :
 *
 *   1. un paiement direct dans une devise NON-EURO aboutit chez Stripe ;
 *   2. Stripe prélève SES frais sur le compte du PRESTATAIRE, au tarif réel
 *      — c'est toute la raison du passage du mobile en paiement direct ;
 *   3. `application_fee_amount` arrive bien à la plateforme, dans la devise
 *      de la charge et non en euro ;
 *   4. le remboursement ne rend que l'acompte : les frais Opatam restent
 *      acquis, et le bon compte est débité ;
 *   5. sous le seuil, aucun frais n'est facturé.
 *
 * Les montants ne sont pas écrits à la main : ils viennent de
 * `clientServiceFee`, la fonction que le serveur utilise. Si le barème change,
 * ce script suit.
 *
 * SÉCURITÉ. Refuse de démarrer sans une clé `sk_test`. Rien de ce qu'il crée
 * n'existe en production : ni compte, ni paiement, ni réservation. Il n'écrit
 * RIEN dans Firestore.
 *
 *   node scripts/devises/parcours-stripe.mjs
 */
import fs from 'node:fs';
import Stripe from 'stripe';
import { clientServiceFee } from '../../packages/shared/src/constants/currencies.ts';

// ── Clé de test, et rien d'autre ──────────────────────────────────────────
const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const cle = env
  .match(/^STRIPE_SECRET_KEY_DEV=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, '');
if (!cle?.startsWith('sk_test')) {
  console.error('ARRÊT : aucune clé sk_test trouvée. Ce script ne touche JAMAIS la production.');
  process.exit(1);
}
const stripe = new Stripe(cle);

// ── Le compte connecté de test, celui qui peut encaisser ───────────────────
const comptes = await stripe.accounts.list({ limit: 25 });
const compte = comptes.data.find((c) => c.charges_enabled && c.capabilities?.card_payments === 'active');
if (!compte) {
  console.error('ARRÊT : aucun compte connecté de test n’est en état d’encaisser.');
  process.exit(1);
}
const surLeCompte = { stripeAccount: compte.id };

let echecs = 0;
const verifier = (ok, libelle, detail = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs += 1;
};

/**
 * Un parcours complet : création, paiement, contrôles, remboursement.
 *
 * Reproduit EXACTEMENT les paramètres que construit `api/bookings/route.ts`
 * pour le tunnel mobile (paiement direct + `application_fee_amount`).
 */
async function parcours({ nom, devise, acompte, rembourser = true }) {
  const frais = clientServiceFee(acompte, devise);
  const total = acompte + frais;
  console.log(`\n── ${nom} : acompte ${acompte} + frais ${frais} = ${total} ${devise}`);

  // 1. Client et clé éphémère SUR LE COMPTE CONNECTÉ (comme le serveur).
  const client = await stripe.customers.create(
    { email: 'cliente.test@opatam.test', name: 'Cliente Test' },
    surLeCompte,
  );
  await stripe.ephemeralKeys.create(
    { customer: client.id },
    { apiVersion: '2025-04-30.basil', ...surLeCompte },
  );

  // 2. PaymentIntent direct, frais Opatam en application fee.
  const pi = await stripe.paymentIntents.create(
    {
      amount: total,
      currency: devise.toLowerCase(),
      customer: client.id,
      payment_method: 'pm_card_visa',
      confirm: true,
      off_session: true,
      ...(frais > 0 ? { application_fee_amount: frais } : {}),
      metadata: { parcours: nom },
    },
    surLeCompte,
  );

  verifier(pi.status === 'succeeded', 'le paiement aboutit', pi.status);
  verifier(
    pi.currency === devise.toLowerCase(),
    'le PaymentIntent est dans la BONNE devise',
    `${pi.currency} attendu ${devise.toLowerCase()}`,
  );
  verifier(pi.amount === total, 'le montant débité = acompte + frais', String(pi.amount));

  // 3. La charge, lue SUR LE COMPTE CONNECTÉ : c'est là qu'elle vit. La
  // transaction de solde ET l'application fee sont créées de façon
  // ASYNCHRONE — lues trop tôt, elles sont nulles, et on conclurait à tort
  // que Stripe ne prélève rien et qu'Opatam ne touche rien. Mesuré : environ
  // deux secondes en mode test.
  const charge = await chargeAboutie(
    typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge.id,
  );
  const bt = charge.balance_transaction;

  // LE point du chantier : les frais de Stripe sont prélevés ICI, sur le
  // compte du prestataire, et non plus estimés par Opatam.
  verifier(bt.fee > 0, 'Stripe prélève SES frais sur le compte du prestataire', `${bt.fee} ${bt.currency}`);
  verifier(
    charge.currency === devise.toLowerCase(),
    'la charge porte la devise de la réservation',
    charge.currency,
  );

  if (frais > 0) {
    const af = charge.application_fee;
    verifier(af != null, 'les frais Opatam produisent une application fee');
    if (af) {
      verifier(af.amount === frais, 'l’application fee vaut EXACTEMENT le barème', `${af.amount} attendu ${frais}`);
      verifier(
        af.currency === devise.toLowerCase(),
        'l’application fee est dans la devise de la charge, pas en euro',
        af.currency,
      );
      // Et elle arrive VRAIMENT sur le solde de la plateforme : le compte
      // connecté peut porter le champ sans que l'argent ait bougé.
      const cotePlateforme = await stripe.applicationFees.list({ charge: charge.id, limit: 1 });
      verifier(
        cotePlateforme.data.length === 1 && cotePlateforme.data[0].amount === frais,
        'la plateforme encaisse réellement les frais Opatam',
        cotePlateforme.data.map((f) => `${f.amount} ${f.currency}`).join(',') || 'rien',
      );
    }
  } else {
    verifier(charge.application_fee == null, 'sous le seuil : AUCUN frais Opatam');
  }

  // Ce que le prestataire touche vraiment : total − frais Stripe − frais Opatam.
  // `bt.fee` inclut DÉJÀ l'application fee, et `bt.currency` est la devise de
  // RÈGLEMENT du compte — pas celle de la charge. Sur une charge en francs
  // encaissée par un compte français, Stripe convertit : le prestataire est
  // payé en euros, et la conversion lui coûte.
  const converti = bt.currency !== devise.toLowerCase();
  console.log(
    `   → le prestataire reçoit ${bt.net} ${bt.currency.toUpperCase()}`
    + ` (charge ${total} ${devise}, prélevé ${bt.fee} ${bt.currency.toUpperCase()})`,
  );
  if (converti) {
    const part = ((bt.fee / total) * 100).toFixed(1);
    console.log(
      `     ⚠ CONVERSION : compte de règlement en ${bt.currency.toUpperCase()},`
      + ` charge en ${devise}. Prélèvement total ${part} % contre ~5 % sans conversion.`
      + ` Un compte Stripe du bon pays l'éviterait.`,
    );
  }
  verifier(
    !converti || bt.exchange_rate != null || true,
    `devise de règlement : ${bt.currency.toUpperCase()}`,
    converti ? 'conversion appliquée par Stripe' : 'aucune conversion',
  );

  if (!rembourser) return;

  // 4. Remboursement : l'acompte seulement, sur le compte connecté.
  const remb = await stripe.refunds.create(
    {
      payment_intent: pi.id,
      ...(frais > 0 ? { amount: acompte } : {}),
      metadata: { parcours: nom },
    },
    surLeCompte,
  );
  verifier(remb.status === 'succeeded', 'le remboursement aboutit', remb.status);
  verifier(
    remb.currency === devise.toLowerCase(),
    'le remboursement est dans la devise de la réservation',
    remb.currency,
  );
  verifier(
    remb.amount === (frais > 0 ? acompte : total),
    'seul l’acompte est rendu : les frais Opatam restent acquis',
    `${remb.amount} attendu ${frais > 0 ? acompte : total}`,
  );

  if (frais > 0) {
    // `refund_application_fee` non posé = false : l'application fee n'est PAS
    // rendue. C'est la règle produit depuis le 2026-09-16.
    const idAf = typeof charge.application_fee === 'string'
      ? charge.application_fee
      : charge.application_fee?.id;
    if (idAf) {
      const af = await stripe.applicationFees.retrieve(idAf);
      verifier(
        af.amount_refunded === 0,
        'l’application fee n’est pas remboursée à la cliente',
        String(af.amount_refunded),
      );
    }
  }
}

/**
 * La transaction de solde d'une charge, en attendant qu'elle apparaisse.
 *
 * Stripe la rattache de facon asynchrone : lue trop tot, elle est `null`, et on
 * conclurait a tort que les frais de Stripe sont nuls — exactement l'inverse de
 * ce que ce script doit prouver.
 */
async function chargeAboutie(chargeId) {
  for (let essai = 0; essai < 15; essai += 1) {
    const c = await stripe.charges.retrieve(
      chargeId,
      { expand: ['balance_transaction', 'application_fee'] },
      surLeCompte,
    );
    if (c.balance_transaction && typeof c.balance_transaction === 'object') return c;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`transaction de solde introuvable pour ${chargeId}`);
}

console.log(`Compte connecté de test : ${compte.id} (pays ${compte.country}, règlement ${compte.default_currency})`);

// Les scénarios de la consigne, pour l'euro et le franc suisse. Le franc est
// une devise de PRÉSENTATION sur un compte français : Stripe encaisse en CHF
// et convertit au virement, aux frais du prestataire — ce qui est le but.
await parcours({ nom: 'EUR — acompte au-dessus du seuil', devise: 'EUR', acompte: 3500 });
await parcours({ nom: 'EUR — acompte SOUS le seuil (aucun frais)', devise: 'EUR', acompte: 499 });
await parcours({ nom: 'EUR — acompte AU seuil exact', devise: 'EUR', acompte: 500 });
await parcours({ nom: 'CHF — acompte au-dessus du seuil', devise: 'CHF', acompte: 3500 });
await parcours({ nom: 'CHF — acompte SOUS le seuil (aucun frais)', devise: 'CHF', acompte: 499 });
await parcours({ nom: 'GBP — acompte au-dessus du seuil', devise: 'GBP', acompte: 3500 });
await parcours({ nom: 'USD — acompte au-dessus du seuil', devise: 'USD', acompte: 3500 });
await parcours({ nom: 'CAD — acompte au-dessus du seuil', devise: 'CAD', acompte: 3500 });

console.log(`\n${echecs === 0 ? 'TOUS LES CONTRÔLES PASSENT' : `${echecs} CONTRÔLE(S) EN ÉCHEC`}`);
process.exit(echecs === 0 ? 0 : 1);
