/**
 * La prochaine disponibilité d'un salon est celle du PREMIER membre libre,
 * pas celle d'un membre tiré au sort.
 *
 * Le calcul ne regardait qu'un membre : celui par défaut, sinon le premier
 * par ordre d'identifiant. Chez Braidztouch (30/09/2026), c'était une
 * professionnelle fermée toute la semaine : le salon s'affichait sans aucune
 * disponibilité dans la recherche, alors que sa collègue avait des créneaux.
 *
 *   npm --prefix functions run build
 *   ./firestore/run-functions-test.sh
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const functionsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const req = createRequire(resolve(functionsDir, 'package.json'));
const admin = req('firebase-admin');
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST absent : ce test ne tourne que sur l’émulateur.');
}
if (!admin.apps.length) admin.initializeApp({ projectId: 'opatam-functions-test' });
const db = admin.firestore();

const { calculateNextAvailableSlot } = req('./dist/utils/calculateNextAvailableSlot.js');

const PID = 'pro-test-prochaine-dispo';
const LIEU = 'lieu-1';
const jours = [0, 1, 2, 3, 4, 5, 6];

async function semer({ ouvertA, ouvertB, lieuActif = true }) {
  const p = db.doc(`providers/${PID}`);
  await p.set({ businessName: 'Salon test', isPublished: true });
  await p.collection('locations').doc(LIEU).set({ name: 'Salon', isActive: lieuActif, timezone: 'Europe/Paris' });
  // « a-… » vient avant « b-… » par identifiant : c'est lui que l'ancien
  // calcul prenait, faute de membre par défaut.
  for (const [id, ouvert] of [['a-fermee', ouvertA], ['b-ouverte', ouvertB]]) {
    await p.collection('members').doc(id).set({ name: id, isActive: true, isDefault: false, locationId: LIEU });
    for (const d of jours) {
      await p.collection('availability').doc(`${id}_${d}`).set({
        memberId: id,
        locationId: LIEU,
        dayOfWeek: d,
        isOpen: ouvert,
        slots: ouvert ? [{ start: '09:00', end: '18:00' }] : [],
      });
    }
  }
}

async function vider() {
  const p = db.doc(`providers/${PID}`);
  for (const c of ['members', 'availability', 'locations']) {
    const s = await p.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
}

describe('prochaine disponibilité — tous les membres actifs', () => {
  beforeEach(vider);

  it('trouve la collègue ouverte quand le premier membre est fermé toute la semaine', async () => {
    await semer({ ouvertA: false, ouvertB: true });
    const d = await calculateNextAvailableSlot(PID);
    assert.ok(d instanceof Date, 'aucune disponibilité trouvée : seul le premier membre a été regardé');
    // Au plus tard après-demain (on commence demain passé 18 h).
    assert.ok(d.getTime() - Date.now() < 3 * 86_400_000);
  });

  it('personne d’ouvert → aucune disponibilité', async () => {
    await semer({ ouvertA: false, ouvertB: false });
    assert.equal(await calculateNextAvailableSlot(PID), null);
  });

  it('un lieu désactivé n’offre rien', async () => {
    await semer({ ouvertA: true, ouvertB: true, lieuActif: false });
    assert.equal(await calculateNextAvailableSlot(PID), null);
  });
});
