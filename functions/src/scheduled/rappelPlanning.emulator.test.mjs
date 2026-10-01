/**
 * Rappel « semaine prochaine vide » — joué sur l'émulateur, avec les
 * functions COMPILÉES et un « maintenant » choisi :
 *
 *   npm --prefix functions run build
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx firebase emulators:exec --only firestore \
 *     --project opatam-functions-test "node --test functions/src/scheduled/rappelPlanning.emulator.test.mjs"
 *
 * Aucun jeton push n'est semé : rien ne part vers Expo, on lit le bilan.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(resolve(functionsDir, 'package.json'));
const admin = req('firebase-admin');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Ce test ne tourne que sur l’émulateur.');
if (!admin.apps.length) admin.initializeApp({ projectId: 'opatam-functions-test' });
const db = admin.firestore();
const { envoyerRappelsPlanning } = req('./dist/scheduled/sendPlanningReminders.js');

const A = 'pro-test-rappel-a';
const DEMO = 'pro-test-rappel-demo';
// Jeudi 8 octobre 2026, 18 h 30 à Paris (UTC+2) ; la semaine visée commence le lundi 12.
const JEUDI_18H_PARIS = new Date('2026-10-08T16:30:00Z');
const JEUDI_18H_REUNION = new Date('2026-10-08T14:30:00Z');
const DIMANCHE_18H_PARIS = new Date('2026-10-11T16:30:00Z');

async function vider(pid) {
  const p = db.doc(`providers/${pid}`);
  for (const c of ['members', 'locations', 'datedAvailability']) {
    const s = await p.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await p.delete();
}

before(async () => {
  await Promise.all([vider(A), vider(DEMO)]);
  const marqueurs = await db.collection('planningReminders').get();
  await Promise.all(marqueurs.docs.map((d) => d.ref.delete()));

  const p = db.doc(`providers/${A}`);
  await p.set({ businessName: 'Studio test', userId: A, countryCode: 'FR' });
  await p.collection('locations').doc('paris').set({ name: 'Paris', isActive: true, timezone: 'Europe/Paris' });
  await p.collection('locations').doc('reunion').set({ name: 'Saint-Denis', isActive: true, timezone: 'Indian/Reunion' });
  const membre = (id, x) => p.collection('members').doc(id).set({ name: id, isActive: true, locationId: 'paris', ...x });
  await membre('vide', { variableHours: true });
  await membre('rempli', { variableHours: true });
  await membre('semaineType', { variableHours: false });
  await membre('inactif', { variableHours: true, isActive: false });
  await membre('reunion', { variableHours: true, locationId: 'reunion' });
  await p.collection('datedAvailability').add({
    memberId: 'rempli', locationId: 'paris', from: '2026-10-14', to: '2026-10-14', weekdays: [], mode: 'slots',
    slots: [{ start: '14:00', end: '22:00' }], createdAt: admin.firestore.Timestamp.now(),
  });

  const demo = db.doc(`providers/${DEMO}`);
  await demo.set({ businessName: 'Démo', userId: DEMO, demoSeed: 'demo-test' });
  await demo.collection('members').doc('vide').set({ name: 'Démo', isActive: true, variableHours: true });
});

const duSalon = (bilan, pid) => ({
  membres: bilan.membres.filter((m) => m.providerId === pid),
  gerants: bilan.gerants.filter((g) => g.providerId === pid),
});

describe('rappel « semaine prochaine vide »', () => {
  it('jeudi 18 h à Paris : le seul membre en horaires variables sans aucun jour ouvert, et le gérant', async () => {
    const b = duSalon(await envoyerRappelsPlanning(JEUDI_18H_PARIS), A);
    assert.deepEqual(b.membres.map((m) => [m.memberId, m.lundi, m.moment]), [['vide', '2026-10-12', 'jeudi']]);
    assert.deepEqual(b.gerants.map((g) => [g.lundi, g.moment, g.noms]), [['2026-10-12', 'jeudi', ['vide']]]);
  });

  it('même heure, second passage : rien de plus (marqueurs)', async () => {
    const b = duSalon(await envoyerRappelsPlanning(JEUDI_18H_PARIS), A);
    assert.deepEqual(b, { membres: [], gerants: [] });
  });

  it('le salon de démo n’est jamais relancé', async () => {
    const b = duSalon(await envoyerRappelsPlanning(JEUDI_18H_PARIS), DEMO);
    assert.deepEqual(b, { membres: [], gerants: [] });
  });

  it('La Réunion : à 18 h sur place (14 h 30 UTC), pas à 18 h à Paris', async () => {
    const b = duSalon(await envoyerRappelsPlanning(JEUDI_18H_REUNION), A);
    assert.deepEqual(b.membres.map((m) => m.memberId), ['reunion']);
  });

  it('dimanche 18 h : second rappel, seulement si c’est toujours vide', async () => {
    // « vide » ouvre son mardi entre-temps → plus de rappel pour lui.
    await db.doc(`providers/${A}`).collection('datedAvailability').add({
      memberId: 'vide', locationId: 'paris', from: '2026-10-13', to: '2026-10-13', weekdays: [], mode: 'slots',
      slots: [{ start: '10:00', end: '18:00' }], createdAt: admin.firestore.Timestamp.now(),
    });
    // « retardataire », lui, rejoint l'équipe en horaires variables et ne remplit rien.
    await db.doc(`providers/${A}`).collection('members').doc('retardataire').set({
      name: 'retardataire', isActive: true, locationId: 'paris', variableHours: true,
    });
    const b = duSalon(await envoyerRappelsPlanning(DIMANCHE_18H_PARIS), A);
    assert.deepEqual(b.membres.map((m) => [m.memberId, m.lundi, m.moment]), [['retardataire', '2026-10-12', 'dimanche']]);
    assert.deepEqual(b.gerants.map((g) => [g.moment, g.noms]), [['dimanche', ['retardataire']]]);
  });

  it('un autre jour, ou une autre heure : rien', async () => {
    const mercredi = duSalon(await envoyerRappelsPlanning(new Date('2026-10-07T16:30:00Z')), A);
    const jeudi17h = duSalon(await envoyerRappelsPlanning(new Date('2026-10-08T15:30:00Z')), A);
    assert.deepEqual([mercredi, jeudi17h], [{ membres: [], gerants: [] }, { membres: [], gerants: [] }]);
  });
});
