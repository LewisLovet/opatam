/**
 * Purge du seed « captures store » (scripts/seed-demo-store-shots.mjs).
 *
 * Supprime tout ce qui porte `demoSeed: demo-store-shots-2026-07` et restaure
 * l'état sauvegardé dans demoSeedBackups/{PID} :
 *   1. bookings taggés (les triggers prod recalculent stats + providerClients)
 *   2. blockedSlots taggés
 *   3. provider : settings.loyalty + isTest restaurés
 *   4. services : variations/options/discount restaurés
 *   5. providerClients des clients de démo (uids demoseed-… / emails bwemba13+…)
 *   6. providerStatsRolling recalculé
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/purge-demo-store-shots.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TAG = 'demo-store-shots-2026-07';
const PID = '67urFFyBFlUHd9Oa1QF8C2fcQha2';
const NOW = new Date();

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();
const providerRef = db.collection('providers').doc(PID);

// ── 1. Bookings taggés ──────────────────────────────────────────────
let deleted = 0;
for (;;) {
  const snap = await db.collection('bookings').where('demoSeed', '==', TAG).limit(50).get();
  if (snap.empty) break;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  deleted += snap.size;
  process.stdout.write(`  bookings supprimés : ${deleted}\r`);
  await new Promise((r) => setTimeout(r, 800)); // triggers de recompute
}
console.log(`\nbookings supprimés : ${deleted}`);

// ── 2. blockedSlots taggés ──────────────────────────────────────────
const bs = await providerRef.collection('blockedSlots').where('demoSeed', '==', TAG).get();
for (const d of bs.docs) await d.ref.delete();
console.log(`blockedSlots supprimés : ${bs.size}`);

// ── 3+4. Restauration provider + services depuis le backup ──────────
const backupSnap = await db.collection('demoSeedBackups').doc(PID).get();
if (backupSnap.exists) {
  const backup = backupSnap.data();
  await providerRef.update({
    'settings.loyalty': backup.settingsLoyalty ?? FieldValue.delete(),
    isTest: backup.isTest ?? FieldValue.delete(),
  });
  for (const [svcId, fields] of Object.entries(backup.services ?? {})) {
    await providerRef.collection('services').doc(svcId).update({
      variations: fields.variations ?? FieldValue.delete(),
      options: fields.options ?? FieldValue.delete(),
      discount: fields.discount ?? FieldValue.delete(),
      updatedAt: Timestamp.fromDate(NOW),
    });
  }
  await backupSnap.ref.delete();
  console.log('provider + services restaurés depuis le backup');
} else {
  console.warn('ATTENTION : pas de backup demoSeedBackups/' + PID + ' — restauration manuelle nécessaire');
}

// ── 5. providerClients de démo ──────────────────────────────────────
// Les triggers ont recalculé après suppression des bookings, mais un doc
// peut rester (recompute ne supprime pas un client à zéro). On balaie.
await new Promise((r) => setTimeout(r, 10000));
const pcSnap = await db.collection('providerClients').where('providerId', '==', PID).get();
let pcDeleted = 0;
for (const d of pcSnap.docs) {
  const c = d.data();
  const isDemo =
    (c.clientId && String(c.clientId).startsWith('demoseed-')) ||
    (c.email && (String(c.email).startsWith('bwemba13+') || String(c.email).endsWith('@example.com')));
  if (isDemo) {
    await d.ref.delete();
    pcDeleted++;
  }
}
console.log(`providerClients de démo supprimés : ${pcDeleted}`);

// ── 5b. Vues de page seedées ────────────────────────────────────────
// Docs quotidiens/mensuels taggés : suppression, sauf si un compte
// préexistant a été sauvegardé (pageViewsPriors) → restauration.
const backup2 = backupSnap.exists ? backupSnap.data() : {};
const priors = backup2.pageViewsPriors ?? { daily: {}, monthly: {} };
for (const col of ['pageViewsDaily', 'pageViewsMonthly']) {
  const snap = await db.collection(col).where('demoSeed', '==', TAG).where('providerId', '==', PID).get();
  for (const d of snap.docs) {
    const data = d.data();
    const key = col === 'pageViewsDaily' ? data.date : data.month;
    const prior = (col === 'pageViewsDaily' ? priors.daily : priors.monthly)?.[key];
    if (prior != null) {
      await d.ref.set({ providerId: PID, [col === 'pageViewsDaily' ? 'date' : 'month']: key, count: prior });
    } else {
      await d.ref.delete();
    }
  }
  console.log(`${col} nettoyé (${snap.size} docs)`);
}
if (backupSnap.exists) {
  await providerRef.update({ 'stats.pageViews': backup2.pageViews ?? FieldValue.delete() });
  console.log('stats.pageViews restauré');
}

// ── 6. Rolling recalculé ────────────────────────────────────────────
const agg = require('../functions/dist/lib/providerStatsAgg.js');
const cutoff90 = new Date(NOW.getTime() - 90 * 24 * 3600 * 1000);
const [dailiesSnap, bookingsSnap] = await Promise.all([
  db.collection('providerStatsDaily').where('providerId', '==', PID).get(),
  db.collection('bookings').where('providerId', '==', PID).where('datetime', '>=', Timestamp.fromDate(cutoff90)).get(),
]);
const rolling = agg.aggregateRolling(
  dailiesSnap.docs.map((d) => d.data()),
  bookingsSnap.docs.map((d) => agg.bookingFromFirestore(d.data())),
  PID,
  NOW
);
await db.collection('providerStatsRolling').doc(PID).set(rolling, { merge: false });
console.log('providerStatsRolling recalculé');

console.log('\nPURGE TERMINÉE');
