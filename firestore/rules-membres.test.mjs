/**
 * Règles de l'espace membre — ce qu'un membre connecté peut écrire.
 *
 * Le lien compte ↔ membre vit dans `memberAccounts/{uid}`, écrit par le
 * serveur seul. Un membre règle SES horaires et SES blocages, pour SON lieu,
 * et tient SA fiche (nom, téléphone, photo) — rien d'autre. Ce test fige ces
 * limites, et surtout ce qui doit rester refusé : l'autre membre, l'autre
 * lieu, l'autre salon, l'accès retiré, l'auto-promotion.
 *
 * Exécution : ./firestore/run-rules-test.sh
 */

import { readFileSync } from 'fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'opatam-rules-test',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await env?.cleanup();
});

// L'état de départ est reposé avant CHAQUE test : un test qui supprime ou
// modifie ne doit pas en fausser un autre.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const pose = (chemin, data) => setDoc(doc(db, chemin), data);
    await pose('providers/salon-a/members/m1', { name: 'Jean', phone: null, photoURL: null, locationId: 'l1', isActive: true, isDefault: false, sortOrder: 1 });
    await pose('providers/salon-a/members/m2', { name: 'Lina', phone: null, photoURL: null, locationId: 'l2', isActive: true, isDefault: false, sortOrder: 2 });
    await pose('providers/salon-b/members/n1', { name: 'Paul', locationId: 'lb', isActive: true });
    await pose('memberAccounts/u-jean', { providerId: 'salon-a', memberId: 'm1', email: 'jean@x.test', active: true });
    await pose('memberAccounts/u-lina', { providerId: 'salon-a', memberId: 'm2', email: 'lina@x.test', active: false });
    await pose('memberAccounts/u-paul', { providerId: 'salon-b', memberId: 'n1', email: 'paul@x.test', active: true });
    await pose('providers/salon-a/availability/m1_1', { memberId: 'm1', locationId: 'l1', dayOfWeek: 1, isOpen: true, slots: [] });
    await pose('providers/salon-a/availability/m2_1', { memberId: 'm2', locationId: 'l2', dayOfWeek: 1, isOpen: true, slots: [] });
    await pose('providers/salon-a/blockedSlots/bs-m1', { memberId: 'm1', locationId: 'l1', reason: 'Formation' });
    await pose('providers/salon-a/blockedSlots/bs-m2', { memberId: 'm2', locationId: 'l2', reason: 'Congés' });
    await pose('memberInvitations/inv-1', { providerId: 'salon-a', memberId: 'm1', email: 'jean@x.test', status: 'pending' });
  });
});

const en = (uid) => env.authenticatedContext(uid).firestore();
const anonyme = () => env.unauthenticatedContext().firestore();
const jour = (memberId, locationId, dayOfWeek) => ({ memberId, locationId, dayOfWeek, isOpen: true, slots: [{ start: '09:00', end: '12:00' }] });

describe('memberAccounts — le lien compte ↔ membre', () => {
  it('le membre lit le sien, pas celui d’un autre', async () => {
    await assertSucceeds(getDoc(doc(en('u-jean'), 'memberAccounts/u-jean')));
    await assertFails(getDoc(doc(en('u-jean'), 'memberAccounts/u-lina')));
  });
  it('un compte sans lien lit « rien » chez lui (l’app sait qu’il n’est pas membre)', async () => {
    const snap = await assertSucceeds(getDoc(doc(en('u-client'), 'memberAccounts/u-client')));
    if (snap.exists()) throw new Error('ne devrait pas exister');
  });
  it('le gérant lit ceux de SON salon, pas ceux d’un autre', async () => {
    await assertSucceeds(getDocs(query(collection(en('salon-a'), 'memberAccounts'), where('providerId', '==', 'salon-a'))));
    await assertFails(getDoc(doc(en('salon-b'), 'memberAccounts/u-jean')));
  });
  it('PERSONNE ne se crée un lien depuis l’app — ni le membre, ni un gérant, ni un inconnu', async () => {
    await assertFails(setDoc(doc(en('u-pirate'), 'memberAccounts/u-pirate'), { providerId: 'salon-a', memberId: 'm1', active: true }));
    await assertFails(setDoc(doc(en('salon-a'), 'memberAccounts/u-x'), { providerId: 'salon-a', memberId: 'm1', active: true }));
    await assertFails(setDoc(doc(anonyme(), 'memberAccounts/u-y'), { providerId: 'salon-a', memberId: 'm1', active: true }));
  });
  it('le membre ne réactive ni ne déplace son lien', async () => {
    await assertFails(updateDoc(doc(en('u-lina'), 'memberAccounts/u-lina'), { active: true }));
    await assertFails(updateDoc(doc(en('u-jean'), 'memberAccounts/u-jean'), { memberId: 'm2' }));
  });
  it('le gérant retire l’accès d’un membre de SON salon ; un autre gérant non', async () => {
    await assertFails(deleteDoc(doc(en('salon-b'), 'memberAccounts/u-jean')));
    await assertSucceeds(deleteDoc(doc(en('salon-a'), 'memberAccounts/u-jean')));
  });
});

describe('memberInvitations', () => {
  it('lues par le gérant du salon seulement, écrites par personne', async () => {
    await assertSucceeds(getDoc(doc(en('salon-a'), 'memberInvitations/inv-1')));
    await assertFails(getDoc(doc(en('u-jean'), 'memberInvitations/inv-1')));
    await assertFails(getDoc(doc(en('salon-b'), 'memberInvitations/inv-1')));
    await assertFails(setDoc(doc(en('salon-a'), 'memberInvitations/inv-2'), { providerId: 'salon-a', status: 'accepted' }));
  });
});

describe('la fiche du membre', () => {
  it('il change son nom, son téléphone, sa photo', async () => {
    await assertSucceeds(updateDoc(doc(en('u-jean'), 'providers/salon-a/members/m1'), { name: 'Jean D.', phone: '0600000000', photoURL: 'https://x/p.jpg' }));
  });
  it('mais ni son lieu, ni son statut, ni son ordre, ni « membre principal »', async () => {
    const m1 = doc(en('u-jean'), 'providers/salon-a/members/m1');
    await assertFails(updateDoc(m1, { locationId: 'l2' }));
    await assertFails(updateDoc(m1, { isActive: false }));
    await assertFails(updateDoc(m1, { sortOrder: 0 }));
    await assertFails(updateDoc(m1, { isDefault: true }));
    await assertFails(updateDoc(m1, { name: 'x', isDefault: true }));
  });
  it('ni la fiche d’un collègue, ni celle d’un autre salon', async () => {
    await assertFails(updateDoc(doc(en('u-jean'), 'providers/salon-a/members/m2'), { name: 'pirate' }));
    await assertFails(updateDoc(doc(en('u-jean'), 'providers/salon-b/members/n1'), { name: 'pirate' }));
  });
  it('accès désactivé ou inconnu : rien', async () => {
    await assertFails(updateDoc(doc(en('u-lina'), 'providers/salon-a/members/m2'), { name: 'Lina B.' }));
    await assertFails(updateDoc(doc(en('u-client'), 'providers/salon-a/members/m1'), { name: 'x' }));
  });
});

describe('les horaires du membre', () => {
  it('il règle les siens, pour son lieu', async () => {
    const db = en('u-jean');
    await assertSucceeds(setDoc(doc(db, 'providers/salon-a/availability/m1_1'), jour('m1', 'l1', 1)));
    await assertSucceeds(setDoc(doc(db, 'providers/salon-a/availability/m1_3'), jour('m1', 'l1', 3)));
    await assertSucceeds(deleteDoc(doc(db, 'providers/salon-a/availability/m1_1')));
  });
  it('pas pour un autre lieu', async () => {
    await assertFails(setDoc(doc(en('u-jean'), 'providers/salon-a/availability/m1_4'), jour('m1', 'l2', 4)));
    await assertFails(setDoc(doc(en('u-jean'), 'providers/salon-a/availability/m1_1'), jour('m1', 'l2', 1)));
  });
  it('pas ceux d’un collègue — ni en écrivant chez lui, ni en s’appropriant les siens', async () => {
    const db = en('u-jean');
    await assertFails(setDoc(doc(db, 'providers/salon-a/availability/m2_1'), jour('m2', 'l2', 1)));
    await assertFails(setDoc(doc(db, 'providers/salon-a/availability/m2_1'), jour('m1', 'l1', 1)));
    await assertFails(deleteDoc(doc(db, 'providers/salon-a/availability/m2_1')));
    await assertFails(setDoc(doc(db, 'providers/salon-a/availability/m1_5'), jour('m2', 'l2', 5)));
  });
  it('un document ne change pas de membre', async () => {
    await assertFails(setDoc(doc(en('u-jean'), 'providers/salon-a/availability/m1_1'), jour('m2', 'l2', 1)));
  });
  it('accès désactivé, autre salon, inconnu : rien', async () => {
    await assertFails(setDoc(doc(en('u-lina'), 'providers/salon-a/availability/m2_1'), jour('m2', 'l2', 1)));
    await assertFails(setDoc(doc(en('u-paul'), 'providers/salon-a/availability/m1_1'), jour('m1', 'l1', 1)));
    await assertFails(setDoc(doc(anonyme(), 'providers/salon-a/availability/m1_1'), jour('m1', 'l1', 1)));
  });
});

describe('les indisponibilités et activités du membre', () => {
  const blocage = (memberId, locationId) => ({ memberId, locationId, reason: 'Rendez-vous médical', allDay: true });
  it('il pose, modifie et retire les siennes', async () => {
    const db = en('u-jean');
    await assertSucceeds(setDoc(doc(db, 'providers/salon-a/blockedSlots/nouveau'), blocage('m1', 'l1')));
    await assertSucceeds(updateDoc(doc(db, 'providers/salon-a/blockedSlots/bs-m1'), { reason: 'Formation couleur' }));
    await assertSucceeds(deleteDoc(doc(db, 'providers/salon-a/blockedSlots/bs-m1')));
  });
  it('pas pour un collègue, pas pour un autre lieu, pas en changeant de membre', async () => {
    const db = en('u-jean');
    await assertFails(setDoc(doc(db, 'providers/salon-a/blockedSlots/x'), blocage('m2', 'l2')));
    await assertFails(setDoc(doc(db, 'providers/salon-a/blockedSlots/y'), blocage('m1', 'l2')));
    await assertFails(updateDoc(doc(db, 'providers/salon-a/blockedSlots/bs-m2'), { reason: 'pirate' }));
    await assertFails(deleteDoc(doc(db, 'providers/salon-a/blockedSlots/bs-m2')));
    await assertFails(updateDoc(doc(db, 'providers/salon-a/blockedSlots/bs-m1'), { memberId: 'm2', locationId: 'l2' }));
  });
  it('accès retiré par le gérant : plus rien, à la seconde', async () => {
    await assertSucceeds(deleteDoc(doc(en('salon-a'), 'memberAccounts/u-jean')));
    await assertFails(setDoc(doc(en('u-jean'), 'providers/salon-a/blockedSlots/apres'), blocage('m1', 'l1')));
    await assertFails(setDoc(doc(en('u-jean'), 'providers/salon-a/availability/m1_1'), jour('m1', 'l1', 1)));
  });
});

describe('le gérant garde la main sur tout', () => {
  it('horaires, blocages et fiches de tous ses membres', async () => {
    const db = en('salon-a');
    await assertSucceeds(setDoc(doc(db, 'providers/salon-a/availability/m2_1'), jour('m2', 'l2', 1)));
    await assertSucceeds(deleteDoc(doc(db, 'providers/salon-a/blockedSlots/bs-m1')));
    await assertSucceeds(updateDoc(doc(db, 'providers/salon-a/members/m1'), { locationId: 'l2', sortOrder: 5 }));
  });
});
