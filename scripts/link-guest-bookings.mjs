/**
 * Rattache les réservations faites SANS COMPTE au compte créé ensuite avec
 * la même adresse e-mail.
 *
 * LE PROBLÈME. Une réservation ne remplit la carte de fidélité que si elle
 * porte un `clientId` — c.-à-d. si elle a été faite en étant connecté. Une
 * cliente qui réserve en invitée puis crée un compte n'est jamais rattachée
 * à sa propre réservation : son rendez-vous ne compte pas, et sa fiche
 * n'ayant aucun `clientId`, `/api/loyalty/me` (qui cherche par `clientId`)
 * ne lui montre même AUCUNE carte chez ce prestataire.
 *
 * CE QUE FAIT LE SCRIPT. Pour chaque réservation sans `clientId` dont
 * l'adresse correspond à un compte Firebase existant, il pose ce
 * `clientId`. Le trigger `onBookingWriteProviderStats` recalcule alors la
 * fiche client : la clé (email-first) ne change pas, le `clientId` y est
 * reporté et les compteurs de fidélité se remettent à jour tout seuls.
 *
 * DEUX RÈGLES QUI NE BOUGENT PAS, et qui expliquent qu'un rattachement ne
 * donne pas toujours un point :
 *   - non-rétroactivité : une réservation créée avant le lancement de la
 *     fidélité (LOYALTY_LAUNCH_AT) ne compte pas, même rattachée ;
 *   - un rendez-vous doit être honoré : confirmé ET déjà passé.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/link-guest-bookings.mjs
 *   SA_PATH="$PWD/service-account.json" node scripts/link-guest-bookings.mjs --apply
 *   ... --provider=<providerId>   pour restreindre à un prestataire
 *
 * Sans --apply, RIEN n'est écrit : le script se contente d'afficher ce
 * qu'il ferait.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const PROVIDER_FILTER =
  process.argv.find((a) => a.startsWith('--provider='))?.split('=')[1] ?? null;

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();
const auth = getAuth();

/** Doit rester en phase avec functions/src/utils/loyaltyMirror.ts. */
const LOYALTY_LAUNCH_AT = new Date('2026-07-20T00:00:00+02:00').getTime();
const NOW = Date.now();

const norm = (s) => (s ?? '').toLowerCase().trim();

console.log(APPLY ? '=== APPLICATION ===' : '=== DRY RUN (aucune écriture) ===');
if (PROVIDER_FILTER) console.log('Restreint au prestataire :', PROVIDER_FILTER);

// 1. Toutes les réservations sans compte.
let query = db.collection('bookings');
if (PROVIDER_FILTER) query = query.where('providerId', '==', PROVIDER_FILTER);
const snap = await query.get();
const guests = snap.docs.filter((d) => !d.data().clientId && norm(d.data().clientInfo?.email));
console.log(`\nRéservations examinées : ${snap.size}`);
console.log(`  dont sans compte     : ${guests.length}`);

// 2. Quelles adresses correspondent à un compte existant ?
const emails = [...new Set(guests.map((d) => norm(d.data().clientInfo.email)))];
const uidByEmail = new Map();
const verifiedByEmail = new Map();
for (let i = 0; i < emails.length; i += 100) {
  const res = await auth.getUsers(emails.slice(i, i + 100).map((email) => ({ email })));
  for (const u of res.users) {
    uidByEmail.set(norm(u.email), u.uid);
    verifiedByEmail.set(norm(u.email), u.emailVerified);
  }
}
console.log(`  adresses distinctes  : ${emails.length}`);
console.log(`  → avec un compte     : ${uidByEmail.size}`);

// 3. Regroupement par cliente, avec l'effet fidélité attendu.
const providerCache = new Map();
async function providerInfo(id) {
  if (!providerCache.has(id)) {
    const p = (await db.collection('providers').doc(id).get()).data();
    // Une carte n'apparaît dans /api/loyalty/me que si le prestataire est
    // publié, sa fidélité correctement réglée et son abonnement actif —
    // mêmes conditions que la route. Miroir volontairement minimal.
    const l = p?.settings?.loyalty;
    const sub = p?.subscription ?? {};
    const accesFidelite =
      !!l?.enabled &&
      Number.isInteger(l?.threshold) &&
      l.threshold >= 1 &&
      (sub.status === 'active' ||
        (sub.status === 'trialing' && !!(sub.stripeSubscriptionId || sub.revenuecatAppUserId)) ||
        p?.accessOverride?.active === true);
    providerCache.set(id, {
      name: p?.businessName ?? id,
      isTest: p?.isTest === true,
      carteVisible: !!p?.isPublished && accesFidelite,
    });
  }
  return providerCache.get(id);
}
const providerName = async (id) => (await providerInfo(id)).name;

const byEmail = new Map();
for (const d of guests) {
  const email = norm(d.data().clientInfo.email);
  const uid = uidByEmail.get(email);
  if (!uid) continue;
  const b = d.data();
  const createdAt = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
  const datetime = b.datetime?.toDate?.()?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
  const gagnePoint =
    b.status === 'confirmed' && createdAt >= LOYALTY_LAUNCH_AT && datetime <= NOW;
  const entry = byEmail.get(email) ?? { uid, name: b.clientInfo?.name, bookings: [] };
  entry.bookings.push({
    ref: d.ref,
    id: d.id,
    providerId: b.providerId,
    status: b.status,
    createdAt,
    datetime,
    gagnePoint,
    raison: gagnePoint
      ? 'point'
      : b.status !== 'confirmed'
        ? b.status
        : createdAt < LOYALTY_LAUNCH_AT
          ? 'avant lancement'
          : 'RDV à venir',
  });
  byEmail.set(email, entry);
}

console.log(`\n${'─'.repeat(78)}`);
let totalBookings = 0;
let totalPoints = 0;
const cartesRendues = new Set();
const clientesTest = new Set();
for (const [email, e] of [...byEmail.entries()].sort()) {
  const verifie = verifiedByEmail.get(email) ? 'vérifié' : 'non vérifié';
  const lignes = [];
  for (const b of e.bookings) {
    const info = await providerInfo(b.providerId);
    if (info.isTest) clientesTest.add(email);
    const d = new Date(b.datetime).toISOString().slice(0, 10);
    // Une carte « rendue visible » = fiche rattachée chez un prestataire
    // dont le programme tourne. C'est le vrai gain du rattachement :
    // sans clientId, /api/loyalty/me ne renvoie AUCUNE carte.
    if (info.carteVisible) cartesRendues.add(`${email}|${b.providerId}`);
    lignes.push(
      `   • ${info.name.padEnd(22)} RDV ${d}  ${b.status.padEnd(10)} → ${b.raison}` +
        (info.carteVisible ? '   [carte visible]' : ''),
    );
    totalBookings += 1;
    if (b.gagnePoint) totalPoints += 1;
  }
  console.log(`\n${e.name ?? '?'} <${email}>  (e-mail ${verifie})`);
  for (const l of lignes) console.log(l);
}

console.log(`\n${'─'.repeat(78)}`);
console.log(`Clientes concernées          : ${byEmail.size}`);
console.log(`Réservations à rattacher     : ${totalBookings}`);
console.log(`  → donnant un point fidélité: ${totalPoints}`);
console.log(`  → sans effet sur les points: ${totalBookings - totalPoints}`);
console.log(`\nCARTES RENDUES VISIBLES      : ${cartesRendues.size}`);
console.log('  (couples cliente × prestataire dont le programme fidélité tourne)');
if (clientesTest.size) {
  console.log(`\nDont ${clientesTest.size} cliente(s) touchant un prestataire marqué isTest :`);
  for (const e of clientesTest) console.log(`  ${e}`);
}

if (!APPLY) {
  console.log('\nDry run : aucune écriture. Relancer avec --apply pour appliquer.');
  process.exit(0);
}

// 4. Application. Une écriture par réservation — le trigger
//    onBookingWriteProviderStats se charge de recalculer les fiches.
let written = 0;
for (const [, e] of byEmail) {
  for (const b of e.bookings) {
    await b.ref.update({ clientId: e.uid });
    written += 1;
    if (written % 25 === 0) console.log(`  ... ${written}/${totalBookings}`);
  }
}
console.log(`\n✔ ${written} réservation(s) rattachée(s).`);
console.log('Les fiches clientes se recalculent via le trigger (quelques secondes).');
process.exit(0);
