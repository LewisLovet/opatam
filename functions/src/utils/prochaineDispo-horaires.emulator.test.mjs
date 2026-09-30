/**
 * Prochaine disponibilité — un changement d'horaires programmé ne compte
 * qu'à partir de sa date. Joué sur l'émulateur, avec les functions COMPILÉES :
 *
 *   npm --prefix functions run build
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx firebase emulators:exec --only firestore \
 *     --project opatam-functions-test "node --test functions/src/utils/prochaineDispo-horaires.emulator.test.mjs"
 */
import { describe, it, beforeEach } from 'node:test';
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
const { calculateNextAvailableSlot } = req('./dist/utils/calculateNextAvailableSlot.js');

const PID = 'pro-test-horaires-programmes';
const p = db.doc(`providers/${PID}`);
const jours = [0, 1, 2, 3, 4, 5, 6];

beforeEach(async () => {
  for (const c of ['members', 'availability', 'locations', 'datedAvailability']) {
    const s = await p.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await p.set({ businessName: 'Salon test', isPublished: true });
  await p.collection('locations').doc('lieu-1').set({ name: 'Salon', isActive: true, timezone: 'Europe/Paris' });
  await p.collection('members').doc('m1').set({ name: 'Jean', isActive: true, isDefault: true, locationId: 'lieu-1' });
  // Fermé toute la semaine : seuls les horaires de base existent.
  for (const d of jours) {
    await p.collection('availability').doc(`m1_${d}`).set({ memberId: 'm1', locationId: 'lieu-1', dayOfWeek: d, isOpen: false, slots: [] });
  }
});

describe('prochaine disponibilité — changements d’horaires programmés', () => {
  it('un changement programmé ne compte qu’à partir de sa date (il s’appliquait dès aujourd’hui)', async () => {
    const effet = new Date(Date.now() + 20 * 86_400_000);
    effet.setHours(0, 0, 0, 0);
    for (const d of jours) {
      await p.collection('availability').doc(`m1_${d}_${effet.getTime()}`).set({
        memberId: 'm1', locationId: 'lieu-1', dayOfWeek: d, isOpen: true,
        slots: [{ start: '09:00', end: '18:00' }],
        effectiveFrom: admin.firestore.Timestamp.fromDate(effet),
      });
    }
    const dispo = await calculateNextAvailableSlot(PID);
    assert.ok(dispo instanceof Date, 'le changement programmé doit ouvrir des créneaux à partir de sa date');
    assert.ok(dispo.getTime() >= effet.getTime() - 86_400_000, `trop tôt : ${dispo.toISOString()} avant ${effet.toISOString()}`);
  });

  it('sans changement programmé : fermé partout → aucune disponibilité', async () => {
    assert.equal(await calculateNextAvailableSlot(PID), null);
  });
});

/** Date calendaire à Paris, dans `n` jours. */
const jourParis = (n) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + n * 86_400_000));
const jourDe = (d) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const ouvrirSemaine = async () => {
  for (const d of jours) {
    await p.collection('availability').doc(`m1_${d}`).set({
      memberId: 'm1', locationId: 'lieu-1', dayOfWeek: d, isOpen: true, slots: [{ start: '09:00', end: '18:00' }],
    });
  }
};
const dater = (r) =>
  p.collection('datedAvailability').add({
    memberId: 'm1', locationId: 'lieu-1', weekdays: [], slots: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(), ...r,
  });

describe('prochaine disponibilité — horaires datés et « horaires variables »', () => {
  it('fermé toute la semaine, un jour ouvert par un horaire daté → ce jour-là', async () => {
    const jour = jourParis(10);
    await dater({ from: jour, to: jour, mode: 'slots', slots: [{ start: '10:00', end: '16:00' }] });
    const dispo = await calculateNextAvailableSlot(PID);
    assert.ok(dispo instanceof Date);
    assert.equal(jourDe(dispo), jour);
  });

  it('« horaires variables » : la semaine type ne compte plus, rien d’ouvert → aucune disponibilité', async () => {
    await ouvrirSemaine();
    await p.collection('members').doc('m1').update({ variableHours: true });
    assert.equal(await calculateNextAvailableSlot(PID), null);
  });

  it('« horaires variables » + un jour ouvert → ce jour-là, pas avant', async () => {
    await ouvrirSemaine();
    await p.collection('members').doc('m1').update({ variableHours: true });
    const jour = jourParis(5);
    await dater({ from: jour, to: jour, mode: 'slots', slots: [{ start: '09:00', end: '12:00' }] });
    const dispo = await calculateNextAvailableSlot(PID);
    assert.ok(dispo instanceof Date);
    assert.equal(jourDe(dispo), jour);
  });

  it('semaine ouverte, période « fermé » : la première disponibilité tombe après la période', async () => {
    await ouvrirSemaine();
    const fin = jourParis(20);
    await dater({ from: jourParis(0), to: fin, mode: 'closed' });
    const dispo = await calculateNextAvailableSlot(PID);
    assert.ok(dispo instanceof Date);
    assert.equal(jourDe(dispo), jourParis(21));
  });

  it('le réglage le plus RÉCENT l’emporte : « horaires habituels » rouvre une période fermée', async () => {
    await ouvrirSemaine();
    await dater({ from: jourParis(0), to: jourParis(20), mode: 'closed' });
    await new Promise((r) => setTimeout(r, 20));
    await dater({ from: jourParis(3), to: jourParis(3), mode: 'usual' });
    const dispo = await calculateNextAvailableSlot(PID);
    assert.ok(dispo instanceof Date);
    assert.equal(jourDe(dispo), jourParis(3));
  });
});
