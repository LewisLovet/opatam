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
  for (const c of ['members', 'availability', 'locations']) {
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
