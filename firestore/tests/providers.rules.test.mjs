/**
 * Tests RÉELS des règles Firestore sur l'émulateur — pas une validation
 * syntaxique. Couvre la matrice du chantier accès offerts :
 *   - un client ne peut pas fabriquer un état qui ressemble à un abonnement
 *     payant, une Sérénité, un Stripe Connect opérationnel ou un comp ;
 *   - les champs commerciaux sont interdits en update ;
 *   - le profil, les réglages et `minPrice` restent modifiables.
 *
 * Usage : npx firebase emulators:exec --only firestore \
 *          "node firestore/tests/providers.rules.test.mjs"
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'rules-test',
  firestore: { rules: readFileSync('firestore/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.error('  ✗', name, '\n   ', e.message?.split('\n')[0]); }
}

const UID = 'pro-1';
const authed = env.authenticatedContext(UID).firestore();
const providerRef = (db) => db.collection('providers').doc(UID);

// Chaque cas de CRÉATION utilise un uid vierge : un `set` sur un document
// déjà créé est un UPDATE pour les règles, et testerait la mauvaise branche.
let n = 0;
function freshCreate(data) {
  const uid = `candidat-${++n}`;
  return env.authenticatedContext(uid).firestore()
    .collection('providers').doc(uid).set({ ...data, userId: uid });
}

/** Document d'inscription légitime — le seed exact de createProvider. */
const seed = {
  userId: UID, plan: 'trial', businessName: 'Salon Test', description: '', category: 'coiffure',
  slug: 'salon-test', photoURL: null, coverPhotoURL: null, portfolioPhotos: [],
  socialLinks: { instagram: null, facebook: null, tiktok: null, website: null, paypal: null },
  rating: { average: 0, count: 0, distribution: {} },
  settings: { timezone: 'Europe/Paris' },
  subscription: {
    plan: 'trial', tier: 'standard', memberCount: 1, validUntil: new Date(Date.now() + 30 * 864e5),
    stripeCustomerId: null, stripeSubscriptionId: null, status: 'trialing',
    currentPeriodEnd: null, cancelAtPeriodEnd: false, paymentSource: null, revenuecatAppUserId: null,
  },
  isPublished: false, isVerified: false, cities: [], region: null, countryCode: 'FR',
  minPrice: null, searchTokens: ['salon'], geopoint: null, nextAvailableSlot: null,
  affiliateCode: null, affiliateId: null,
  stripeConnectAccountId: null, stripeConnectStatus: null,
  stripeConnectChargesEnabled: false, stripeConnectPayoutsEnabled: false,
  depositsAddonActive: false,
};

console.log('\nCRÉATION');
await test('inscription légitime acceptée', () =>
  assertSucceeds(providerRef(authed).set(seed)));
await test("faux subscription.status 'active' refusé", () =>
  assertFails(freshCreate({ ...seed, subscription: { ...seed.subscription, status: 'active' } })));
await test("faux subscription.plan 'team' refusé", () =>
  assertFails(freshCreate({ ...seed, subscription: { ...seed.subscription, plan: 'team' } })));
await test('faux stripeSubscriptionId refusé', () =>
  assertFails(freshCreate({ ...seed, subscription: { ...seed.subscription, stripeSubscriptionId: 'sub_x' } })));
await test('faux revenuecatAppUserId refusé', () =>
  assertFails(freshCreate({ ...seed, subscription: { ...seed.subscription, revenuecatAppUserId: 'rc_x' } })));
await test('faux serenity refusé', () =>
  assertFails(freshCreate({ ...seed, serenity: { status: 'active' } })));
await test('faux accessOverride refusé', () =>
  assertFails(freshCreate({ ...seed, accessOverride: { active: true, plan: 'team', until: null } })));
await test('faux depositsAddonActive refusé', () =>
  assertFails(freshCreate({ ...seed, depositsAddonActive: true })));
await test('faux Stripe Connect opérationnel refusé', () =>
  assertFails(freshCreate({ ...seed, stripeConnectAccountId: 'acct_x', stripeConnectChargesEnabled: true })));
await test('création pré-publiée refusée', () =>
  assertFails(freshCreate({ ...seed, isPublished: true })));
await test("création au nom d'un AUTRE uid refusée", () =>
  assertFails(authed.collection('providers').doc('autre-pro').set(seed)));

console.log('\nMISE À JOUR — champs commerciaux (refus attendus)');
for (const [name, patch] of [
  ["s'attribuer accessOverride", { accessOverride: { active: true, plan: 'team', until: null } }],
  ['changer plan', { plan: 'team' }],
  ['changer subscription', { 'subscription.status': 'active' }],
  ['fabriquer serenity', { serenity: { status: 'active' } }],
  ['activer depositsAddonActive', { depositsAddonActive: true }],
  ['se vérifier', { isVerified: true }],
  ['écrire affiliateCode', { affiliateCode: 'HACK' }],
  ['écrire affiliateId', { affiliateId: 'aff-x' }],
  ['gonfler stats', { 'stats.stories.shared': 999 }],
  ['déclarer nextAvailableSlot', { nextAvailableSlot: new Date() }],
  ['écrire stripeConnectChargesEnabled', { stripeConnectChargesEnabled: true }],
]) {
  await test(`${name} → refusé`, () => assertFails(providerRef(authed).update(patch)));
}

console.log('\nMISE À JOUR — écritures légitimes (accepté attendu)');
for (const [name, patch] of [
  ['profil (nom, description, thème)', { businessName: 'Nouveau Nom', description: 'Bio', themeId: 'bleu' }],
  ['réglages (settings)', { 'settings.minBookingNotice': 12 }],
  ['publication (choix du pro)', { isPublished: true }],
  ['minPrice (dérivé catalogue)', { minPrice: 2500 }],
  ['géographie (cities/région)', { cities: ['paris'], region: 'idf' }],
  ['promoSummary', { promoSummary: null }],
]) {
  await test(`${name} → accepté`, () => assertSucceeds(providerRef(authed).update(patch)));
}
await test('un AUTRE utilisateur ne peut pas modifier le doc', () =>
  assertFails(env.authenticatedContext('intrus').firestore().collection('providers').doc(UID).update({ businessName: 'Pwn' })));

await env.cleanup();
console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
