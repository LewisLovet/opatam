/**
 * Parcours CHF COMPLET : réservation → paiement → webhook → Firestore →
 * annulation → remboursement. Sans toucher à la production.
 *
 * Le montage, tel qu'il doit tourner avant ce script :
 *
 *   1. l'émulateur Firestore (`firebase emulators:start --only firestore
 *      --project opatam-da04b`) sur 127.0.0.1:8080 ;
 *   2. le serveur de dev `web-chf` (port 3003) démarré avec
 *      `FIRESTORE_EMULATOR_HOST` posé — le SDK admin ET le SDK client y
 *      parlent à l'émulateur, jamais à la production ;
 *   3. `stripe listen --forward-connect-to localhost:3003/api/stripe/webhook`
 *      pour livrer le VRAI `payment_intent.succeeded` du compte connecté.
 *
 * Ce que ce script prouve, dans l'ordre :
 *
 *   - une réservation CHF en attente de paiement existe (semée ici, avec
 *     EXACTEMENT les champs que `POST /api/bookings` écrit) ;
 *   - le PaymentIntent direct en CHF, créé comme le fait la route, aboutit ;
 *   - le webhook reçu par le serveur passe la réservation à `confirmed`,
 *     l'acompte à `paid`, ET pose `currencyLockedAt` sur le prestataire —
 *     dans le même batch ;
 *   - l'annulation par le lien de la cliente (`POST /api/bookings/cancel`)
 *     rembourse l'acompte sur le compte CONNECTÉ, en CHF, sans les frais
 *     Opatam, et le journalise sur la réservation.
 *
 * Ce qu'il ne prouve PAS : l'e-mail de confirmation, envoyé par le trigger
 * `onBookingWrite` des functions, qui ne tourne pas ici. Son formatage est
 * couvert par `functions/src/lib/devise.node.test.mjs` (miroir ≡ shared).
 *
 * SÉCURITÉ : refuse de démarrer sans `sk_test`, sans émulateur joignable, et
 * sans serveur sur le port 3003.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   node --experimental-strip-types scripts/devises/parcours-chf-complet.mjs
 */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { clientServiceFee } from '../../packages/shared/src/constants/currencies.ts';

const SERVEUR = 'http://localhost:3003';
const PROJET = 'opatam-da04b';

// ── Gardes ─────────────────────────────────────────────────────────────────
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('ARRÊT : FIRESTORE_EMULATOR_HOST absent. Ce script ne parle JAMAIS à la production.');
  process.exit(1);
}
const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const cle = env.match(/^STRIPE_SECRET_KEY_DEV=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!cle?.startsWith('sk_test')) {
  console.error('ARRÊT : aucune clé sk_test.');
  process.exit(1);
}
try {
  await fetch(`${SERVEUR}/api/health`).catch(() => fetch(SERVEUR));
} catch {
  console.error(`ARRÊT : aucun serveur sur ${SERVEUR}.`);
  process.exit(1);
}

const stripe = new Stripe(cle);
admin.initializeApp({ projectId: PROJET });
const db = admin.firestore();

let echecs = 0;
const verifier = (ok, libelle, detail = '') => {
  console.log(`   ${ok ? '✓' : '✗'} ${libelle}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs += 1;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Le compte connecté de test ─────────────────────────────────────────────
const comptes = await stripe.accounts.list({ limit: 25 });
const compte = comptes.data.find((c) => c.charges_enabled && c.capabilities?.card_payments === 'active');
if (!compte) {
  console.error('ARRÊT : aucun compte connecté de test capable d’encaisser.');
  process.exit(1);
}
const surLeCompte = { stripeAccount: compte.id };

// ── 1. Semis : un prestataire CHF et sa réservation en attente ─────────────
const providerId = `chf-test-${randomUUID().slice(0, 8)}`;
const bookingId = `chf-resa-${randomUUID().slice(0, 8)}`;
const cancelToken = randomUUID();
const DEVISE = 'CHF';
const ACOMPTE = 3500;
const FRAIS = clientServiceFee(ACOMPTE, DEVISE);
const dans7jours = new Date(Date.now() + 7 * 24 * 3600 * 1000);

console.log(`\n── Semis dans l'émulateur (${process.env.FIRESTORE_EMULATOR_HOST})`);
await db.collection('providers').doc(providerId).set({
  userId: `user-${providerId}`,
  businessName: 'Salon Test Genève',
  slug: providerId,
  category: 'beauty',
  currency: DEVISE,
  countryCode: 'CH',
  stripeConnectAccountId: compte.id,
  settings: { depositDefault: { percent: 30, refundDeadlineHours: 24 } },
  isPublished: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
await db.collection('bookings').doc(bookingId).set({
  providerId,
  providerName: 'Salon Test Genève',
  serviceId: 'svc-test',
  serviceName: 'Coupe test',
  duration: 60,
  price: 11_667,
  currency: DEVISE,
  status: 'pending_payment',
  datetime: dans7jours,
  timezone: 'Europe/Zurich',
  clientId: null,
  clientInfo: { name: 'Cliente Test', email: 'cliente.chf@example.com', phone: '+41790000000' },
  clientLocale: 'fr',
  cancelToken,
  deposit: {
    amount: ACOMPTE,
    serviceFee: FRAIS,
    refundDeadlineHours: 24,
    status: 'pending',
    paymentIntentId: null,
    connectAccountId: null,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});
verifier(true, 'prestataire CHF et réservation pending_payment semés', `${providerId} / ${bookingId}`);
const prov0 = (await db.collection('providers').doc(providerId).get()).data();
verifier(!prov0.currencyLockedAt, 'la devise du prestataire est LIBRE avant tout paiement');

// ── 2. Paiement direct en CHF, exactement comme la route mobile ────────────
console.log(`\n── Paiement : acompte ${ACOMPTE} + frais ${FRAIS} = ${ACOMPTE + FRAIS} ${DEVISE}`);
const client = await stripe.customers.create(
  { email: 'cliente.chf@example.com', name: 'Cliente Test' },
  surLeCompte,
);
const pi = await stripe.paymentIntents.create(
  {
    amount: ACOMPTE + FRAIS,
    currency: DEVISE.toLowerCase(),
    customer: client.id,
    payment_method: 'pm_card_visa',
    confirm: true,
    off_session: true,
    ...(FRAIS > 0 ? { application_fee_amount: FRAIS } : {}),
    metadata: { bookingId, providerId, serviceId: 'svc-test', depositAmount: String(ACOMPTE), serviceFee: String(FRAIS) },
  },
  surLeCompte,
);
// Ce que la route écrit juste après avoir créé le PaymentIntent.
await db.collection('bookings').doc(bookingId).update({
  'deposit.paymentIntentId': pi.id,
  'deposit.connectAccountId': compte.id,
});
verifier(pi.status === 'succeeded', 'le PaymentIntent CHF aboutit sur le compte connecté', pi.status);
verifier(pi.currency === 'chf', 'devise du PaymentIntent', pi.currency);

// ── 3. Le webhook, livré par `stripe listen`, confirme dans l'émulateur ────
console.log('\n── Webhook : attente de payment_intent.succeeded → confirmed');
let resa = null;
for (let i = 0; i < 40; i += 1) {
  await attendre(750);
  resa = (await db.collection('bookings').doc(bookingId).get()).data();
  if (resa?.status === 'confirmed') break;
}
verifier(resa?.status === 'confirmed', 'la réservation est CONFIRMÉE par le webhook', resa?.status);
verifier(resa?.deposit?.status === 'paid', 'l’acompte est PAYÉ', resa?.deposit?.status);
verifier(resa?.deposit?.paymentIntentId === pi.id, 'le PaymentIntent est enregistré sur la réservation');
verifier(resa?.currency === DEVISE, 'la réservation garde sa devise', resa?.currency);

const prov1 = (await db.collection('providers').doc(providerId).get()).data();
verifier(!!prov1?.currencyLockedAt, 'la devise du prestataire est FIGÉE (même batch que la confirmation)');

// ── 4. Annulation par la cliente → remboursement sur le compte connecté ────
console.log('\n── Annulation par le lien de la cliente → remboursement');
const rep = await fetch(`${SERVEUR}/api/bookings/cancel`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cancelToken, reason: 'parcours de test CHF' }),
});
const corps = await rep.json().catch(() => ({}));
verifier(rep.ok, `POST /api/bookings/cancel répond ${rep.status}`, JSON.stringify(corps).slice(0, 140));

let resa2 = null;
for (let i = 0; i < 20; i += 1) {
  await attendre(500);
  resa2 = (await db.collection('bookings').doc(bookingId).get()).data();
  if (resa2?.deposit?.status === 'refunded') break;
}
verifier(resa2?.status === 'cancelled', 'la réservation est ANNULÉE', resa2?.status);
verifier(resa2?.deposit?.status === 'refunded', 'l’acompte est REMBOURSÉ dans Firestore', resa2?.deposit?.status);
verifier(!!resa2?.deposit?.refundId, 'le remboursement est journalisé sur la réservation', resa2?.deposit?.refundId);

if (resa2?.deposit?.refundId) {
  const remb = await stripe.refunds.retrieve(resa2.deposit.refundId, surLeCompte);
  verifier(remb.status === 'succeeded', 'le remboursement existe CHEZ STRIPE, sur le compte connecté', remb.status);
  verifier(remb.currency === 'chf', 'le remboursement est en CHF', remb.currency);
  verifier(remb.amount === ACOMPTE, 'seul l’acompte est rendu, les frais Opatam restent acquis', `${remb.amount} attendu ${ACOMPTE}`);
}

const prov2 = (await db.collection('providers').doc(providerId).get()).data();
verifier(!!prov2?.currencyLockedAt, 'le verrou survit à l’annulation : un acompte a bien été encaissé');

// ── 5. Ménage dans l'émulateur (rien en production) ─────────────────────────
await db.collection('bookings').doc(bookingId).delete();
await db.collection('providers').doc(providerId).delete();

console.log(`\n${echecs === 0 ? 'PARCOURS CHF COMPLET : TOUS LES CONTRÔLES PASSENT' : `${echecs} CONTRÔLE(S) EN ÉCHEC`}`);
process.exit(echecs === 0 ? 0 : 1);
