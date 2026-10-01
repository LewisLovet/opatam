/**
 * Notifications du membre — le contexte (compte, jetons, réglages), joué sur
 * l'émulateur avec les functions COMPILÉES (voir firestore/run-functions-test.sh).
 * Aucun envoi réel : on vérifie qui serait joignable, et avec quels réglages.
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
const { chargerContexteMembre } = req('./dist/notifications/memberNotifications.js');

const PID = 'pro-test-notifs-membre';

before(async () => {
  await db.doc(`providers/${PID}`).set({ businessName: 'Studio', countryCode: 'PT', userId: PID });
  await db.doc('memberAccounts/uid-actif').set({ providerId: PID, memberId: 'm1', active: true });
  await db.doc('users/uid-actif').set({
    pushTokens: ['jeton-de-test'],
    notificationSettings: { espaceMembre: { rappels: false } },
  });
  await db.doc('memberAccounts/uid-sans-jeton').set({ providerId: PID, memberId: 'm2', active: true });
  await db.doc('users/uid-sans-jeton').set({ pushTokens: [] });
  await db.doc('memberAccounts/uid-coupe').set({ providerId: PID, memberId: 'm3', active: false });
  await db.doc('users/uid-coupe').set({ pushTokens: ['jeton'] });
});

describe('qui est joignable', () => {
  it('un membre avec compte actif et jeton : oui, dans la langue du salon, réglages appliqués', async () => {
    const ctx = await chargerContexteMembre(PID, 'm1');
    assert.equal(ctx.uid, 'uid-actif');
    assert.equal(ctx.locale, 'pt');
    assert.equal(ctx.active('rendezVous'), true);
    assert.equal(ctx.active('rappels'), false, 'coupé dans ses réglages');
  });
  it('sans jeton, accès retiré, sans compte, ou sans membre : personne', async () => {
    assert.equal(await chargerContexteMembre(PID, 'm2'), null);
    assert.equal(await chargerContexteMembre(PID, 'm3'), null);
    assert.equal(await chargerContexteMembre(PID, 'inconnu'), null);
    assert.equal(await chargerContexteMembre(PID, null), null);
  });
});
