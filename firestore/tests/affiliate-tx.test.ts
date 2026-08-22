/**
 * Test de CONCURRENCE du rattachement affilié, sur l'émulateur Firestore
 * avec le vrai Admin SDK et la vraie transaction (`runAffiliateLink`).
 *
 * Scénario reproduit : double requête réseau / retry — plusieurs appels
 * simultanés portant le même code, puis une seconde vague avec un AUTRE
 * code. Attendu : un seul rattachement, une seule incrémentation, zéro
 * écrasement.
 *
 * Usage : npx firebase emulators:exec --only firestore --project tx-test \
 *          "npx tsx firestore/tests/affiliate-tx.test.ts"
 */
import admin from 'firebase-admin';
import { runAffiliateLink } from '../../apps/web/lib/affiliate-link-tx';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('À lancer via firebase emulators:exec (FIRESTORE_EMULATOR_HOST absent).');
  process.exit(1);
}
admin.initializeApp({ projectId: 'tx-test' });
const db = admin.firestore();

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name, detail !== undefined ? `\n    reçu: ${JSON.stringify(detail)}` : ''); }
}

async function main() {
  const UID = 'pro-tx';
  await db.collection('providers').doc(UID).set({ userId: UID, affiliateCode: null, affiliateId: null });
  await db.collection('affiliates').doc('aff-1').set({ code: 'MARIE', isActive: true, stats: { totalReferrals: 0, trialReferrals: 0 } });
  await db.collection('affiliates').doc('aff-2').set({ code: 'PAUL', isActive: true, stats: { totalReferrals: 0, trialReferrals: 0 } });

  // Vague 1 : cinq requêtes SIMULTANÉES, même code — double clic + retries.
  const wave1 = await Promise.all(
    Array.from({ length: 5 }, () =>
      runAffiliateLink(db, { authUid: UID, providerId: UID, code: 'MARIE', affiliate: { id: 'aff-1' } }),
    ),
  );
  const linked = wave1.filter((d) => d.ok && !d.alreadyLinked);
  const already = wave1.filter((d) => d.ok && d.alreadyLinked);
  check('exactement UN rattachement gagne la course', linked.length === 1, wave1);
  check('les quatre autres ressortent en alreadyLinked', already.length === 4, wave1);

  const provider1 = (await db.collection('providers').doc(UID).get()).data()!;
  check('provider rattaché à aff-1', provider1.affiliateId === 'aff-1', provider1.affiliateId);
  const aff1 = (await db.collection('affiliates').doc('aff-1').get()).data()!;
  check('stats incrémentées UNE seule fois', aff1.stats.totalReferrals === 1 && aff1.stats.trialReferrals === 1, aff1.stats);

  // Vague 2 : trois requêtes simultanées avec un AUTRE code — jamais de
  // réattribution, jamais de comptabilisation pour le second affilié.
  const wave2 = await Promise.all(
    Array.from({ length: 3 }, () =>
      runAffiliateLink(db, { authUid: UID, providerId: UID, code: 'PAUL', affiliate: { id: 'aff-2' } }),
    ),
  );
  check('second code : tous alreadyLinked', wave2.every((d) => d.ok && d.alreadyLinked), wave2);
  const provider2 = (await db.collection('providers').doc(UID).get()).data()!;
  check('le rattachement initial est intact', provider2.affiliateId === 'aff-1' && provider2.affiliateCode === 'MARIE', provider2);
  const aff2 = (await db.collection('affiliates').doc('aff-2').get()).data()!;
  check('aucune stat pour le second affilié', aff2.stats.totalReferrals === 0, aff2.stats);

  console.log(`\n${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
}

void main();
