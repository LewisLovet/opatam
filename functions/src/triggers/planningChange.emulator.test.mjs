/**
 * Changements de planning par un membre → récapitulatif regroupé au gérant.
 * Joué sur l'émulateur avec les functions COMPILÉES (firestore/run-functions-test.sh).
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
const { noterChangementPlanning, envoyerRecapsPlanning, CALME_MS } = req('./dist/triggers/onPlanningChangeByMember.js');

const PID = 'pro-test-changements';

before(async () => {
  const anciens = await db.collection('planningChanges').get();
  await Promise.all(anciens.docs.map((d) => d.ref.delete()));
  await db.doc(`providers/${PID}`).set({ businessName: 'Studio', userId: PID });
  await db.doc(`providers/${PID}/members/m1`).set({ name: 'Léon', isActive: true });
  await db.doc('memberAccounts/uid-leon').set({ providerId: PID, memberId: 'm1', active: true });
  await db.doc('memberAccounts/uid-ailleurs').set({ providerId: 'autre-salon', memberId: 'm9', active: true });
  await db.doc('memberAccounts/uid-retire').set({ providerId: PID, memberId: 'm2', active: false });
});

describe('qui compte', () => {
  it('le membre lui-même, sur SES documents : oui', async () => {
    assert.equal(await noterChangementPlanning({ providerId: PID, authId: 'uid-leon', memberId: 'm1' }), true);
  });
  it('le gérant, un traitement serveur, un autre salon, un accès retiré, le document d’un collègue : non', async () => {
    assert.equal(await noterChangementPlanning({ providerId: PID, authId: PID, memberId: 'm1' }), false);
    assert.equal(await noterChangementPlanning({ providerId: PID, authId: null, memberId: 'm1' }), false);
    assert.equal(await noterChangementPlanning({ providerId: PID, authId: 'uid-ailleurs', memberId: 'm9' }), false);
    assert.equal(await noterChangementPlanning({ providerId: PID, authId: 'uid-retire', memberId: 'm2' }), false);
    assert.equal(await noterChangementPlanning({ providerId: PID, authId: 'uid-leon', memberId: 'm2' }), false);
  });
});

describe('le récapitulatif', () => {
  it('trois modifications → un seul regroupement de 3', async () => {
    await noterChangementPlanning({ providerId: PID, authId: 'uid-leon', memberId: 'm1' });
    await noterChangementPlanning({ providerId: PID, authId: 'uid-leon', memberId: 'm1' });
    const doc = (await db.doc(`planningChanges/${PID}_m1`).get()).data();
    assert.equal(doc.count, 3);
  });
  it('pas avant 10 minutes de calme', async () => {
    const bilan = await envoyerRecapsPlanning(new Date());
    assert.deepEqual(bilan.envoyes.filter((e) => e.providerId === PID), []);
  });
  it('après 10 minutes : un récapitulatif, puis le regroupement est soldé', async () => {
    const bilan = await envoyerRecapsPlanning(new Date(Date.now() + CALME_MS + 1000));
    assert.deepEqual(bilan.envoyes.filter((e) => e.providerId === PID).map((e) => [e.memberId, e.count]), [['m1', 3]]);
    assert.equal((await db.doc(`planningChanges/${PID}_m1`).get()).exists, false);
  });
});
