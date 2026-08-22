/**
 * Tests des règles `users/{uid}` sur l'émulateur — l'escalade de privilège.
 *
 * Le champ `isAdmin` de ce document est lu par 35 fichiers serveur pour
 * accorder l'accès administrateur. Tant que le propriétaire pouvait écrire
 * son document entier, n'importe quel inscrit devenait admin en une écriture.
 *
 * Usage : npx firebase emulators:exec --only firestore --project users-test \
 *          "node firestore/tests/users.rules.test.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'users-test',
  firestore: { rules: readFileSync('firestore/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.error('  ✗', name, '\n   ', e.message?.split('\n')[0]); }
}

const UID = 'user-1';
const db = env.authenticatedContext(UID).firestore();
const me = () => db.collection('users').doc(UID);

const seed = {
  email: 'a@b.c', displayName: 'Alice', phone: null, photoURL: null,
  role: 'client', providerId: null, affiliateId: null, cancellationCount: 0,
};

console.log('\nCRÉATION');
await test('inscription légitime acceptée', () => assertSucceeds(me().set(seed)));
let n = 0;
const fresh = (data) => {
  const uid = `neuf-${++n}`;
  return env.authenticatedContext(uid).firestore().collection('users').doc(uid).set(data);
};
await test('création avec isAdmin: true refusée', () => assertFails(fresh({ ...seed, isAdmin: true })));
await test('création avec adminCodeHash refusée', () => assertFails(fresh({ ...seed, adminCodeHash: 'x' })));
await test('création avec rôle inventé refusée', () => assertFails(fresh({ ...seed, role: 'admin' })));
await test("création rattachée au prestataire d'un tiers refusée", () => assertFails(fresh({ ...seed, providerId: 'autre-pro' })));

console.log("\nESCALADE DE PRIVILÈGE (refus attendus)");
await test('s\'écrire isAdmin: true → REFUSÉ', () => assertFails(me().update({ isAdmin: true })));
await test('s\'écrire adminCodeHash → REFUSÉ', () => assertFails(me().update({ adminCodeHash: '$2a$10$x' })));
await test("se donner un rôle inventé → REFUSÉ", () => assertFails(me().update({ role: 'admin' })));
await test("se donner le rôle 'staff' → REFUSÉ (invitation Admin SDK uniquement)", () =>
  assertFails(me().update({ role: 'staff' })));
await test("se rattacher au prestataire d'un tiers → REFUSÉ", () => assertFails(me().update({ providerId: 'autre-pro' })));
await test('s\'attribuer un affiliateId → REFUSÉ', () => assertFails(me().update({ affiliateId: 'aff-x' })));
await test('modifier son email hors flux serveur → REFUSÉ', () => assertFails(me().update({ email: 'autre@b.c' })));
await test("modifier le document d'un autre → REFUSÉ", () =>
  assertFails(env.authenticatedContext('intrus').firestore().collection('users').doc(UID).update({ displayName: 'Pwn' })));

console.log('\nÉCRITURES LÉGITIMES (accepté attendu)');
await test('profil (nom, téléphone, ville)', () => assertSucceeds(me().update({ displayName: 'Alice B', phone: '0600000000', city: 'Paris' })));
await test('jetons push', () => assertSucceeds(me().update({ pushTokens: ['ExponentPushToken[x]'] })));
await test('préférences de notification', () => assertSucceeds(me().update({ notificationSettings: { reminderNotifications: false } })));
await test("devenir prestataire (rôle + providerId = son propre uid)", () =>
  assertSucceeds(me().update({ role: 'provider', providerId: UID })));
await test('suppression de compte : retour à client', () =>
  assertSucceeds(me().update({ role: 'client', providerId: null })));
await test("compteur d'annulations", () => assertSucceeds(me().update({ cancellationCount: 1 })));

// Un commercial (rôle posé par l'Admin SDK) doit pouvoir modifier son profil
// sans perdre son rôle — la règle n'exige plus que le rôle FINAL soit dans la
// liste publique, seulement qu'il ne CHANGE pas vers un rôle interdit.
await test("un compte 'staff' modifie son profil sans perdre son rôle", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    c.firestore().collection('users').doc('staff-1').set({ email: 's@o.c', role: 'staff', displayName: 'Sam' }));
  await assertSucceeds(
    env.authenticatedContext('staff-1').firestore().collection('users').doc('staff-1')
      .update({ displayName: 'Samuel' }));
});
await test("le SDK client ne lit pas la fiche staffMembers d'un autre", async () => {
  await env.withSecurityRulesDisabled(async (c) =>
    c.firestore().collection('staffMembers').doc('staff-1').set({ role: 'sales', active: true }));
  await assertFails(
    env.authenticatedContext('intrus').firestore().collection('staffMembers').doc('staff-1').get());
  await assertSucceeds(
    env.authenticatedContext('staff-1').firestore().collection('staffMembers').doc('staff-1').get());
});
await test('staffMembers inscriptible par personne côté client', () =>
  assertFails(env.authenticatedContext('staff-1').firestore().collection('staffMembers').doc('staff-1')
    .update({ role: 'sales_manager' })));
await test('salesLeads fermé au SDK client', () =>
  assertFails(env.authenticatedContext('staff-1').firestore().collection('salesLeads').doc('l1')
    .set({ businessName: 'X' })));

await env.cleanup();
console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
