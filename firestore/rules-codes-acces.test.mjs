/**
 * Règles de `memberAccessCodes/{code}` — les codes d'accès au planning.
 *
 * Le code vivait dans la fiche du membre, lisible par tous : n'importe qui
 * ouvrait le planning de n'importe quel membre. Ce test fige la nouvelle
 * règle : seul le gérant du salon lit, crée et retire les codes de SES
 * membres ; personne ne peut réécrire un code existant (c'est ce qui
 * garantit l'unicité) ; et personne ne peut savoir si un code existe.
 *
 * Exécution : ./firestore/run-rules-test.sh
 */

import { readFileSync } from 'fs';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
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
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'providers/salon-a/members/m1'), { name: 'Jean', isActive: true });
    await setDoc(doc(db, 'providers/salon-a/members/m2'), { name: 'Lina', isActive: true });
    await setDoc(doc(db, 'providers/salon-b/members/n1'), { name: 'Paul', isActive: true });
    await setDoc(doc(db, 'memberAccessCodes/JEAN-AB12'), { providerId: 'salon-a', memberId: 'm1' });
    await setDoc(doc(db, 'memberAccessCodes/PAUL-CD34'), { providerId: 'salon-b', memberId: 'n1' });
  });
});

after(async () => {
  await env?.cleanup();
});

const code = (db, c) => doc(db, 'memberAccessCodes', c);
const nouveau = (providerId, memberId) => ({ providerId, memberId, createdAt: serverTimestamp() });

describe('memberAccessCodes — lecture', () => {
  it('un visiteur anonyme ne lit aucun code', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(code(db, 'JEAN-AB12')));
  });

  it('un visiteur ne peut pas savoir si un code existe : lire un code absent est refusé aussi', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(code(db, 'NEXISTE-PAS')));
    const autre = env.authenticatedContext('salon-b').firestore();
    await assertFails(getDoc(code(autre, 'NEXISTE-PAS')));
  });

  it('un autre salon ne lit pas le code, ni seul ni par requête', async () => {
    const db = env.authenticatedContext('salon-b').firestore();
    await assertFails(getDoc(code(db, 'JEAN-AB12')));
    await assertFails(getDocs(query(collection(db, 'memberAccessCodes'), where('providerId', '==', 'salon-a'))));
  });

  it('personne ne liste toute la collection', async () => {
    const db = env.authenticatedContext('salon-a').firestore();
    await assertFails(getDocs(collection(db, 'memberAccessCodes')));
  });

  it('le gérant lit les codes de SON salon, par requête (écran Équipe)', async () => {
    const db = env.authenticatedContext('salon-a').firestore();
    const snap = await assertSucceeds(
      getDocs(query(collection(db, 'memberAccessCodes'), where('providerId', '==', 'salon-a'))),
    );
    assert.deepEqual(snap.docs.map((d) => d.id), ['JEAN-AB12']);
    await assertSucceeds(getDoc(code(db, 'JEAN-AB12')));
  });
});

describe('memberAccessCodes — création', () => {
  it('le gérant crée un code pour un membre de son salon', async () => {
    const db = env.authenticatedContext('salon-a').firestore();
    await assertSucceeds(setDoc(code(db, 'LINA-EF56'), nouveau('salon-a', 'm2')));
  });

  it('un code DÉJÀ PRIS ne se réécrit pas — ni par son gérant, ni par un autre (unicité)', async () => {
    const a = env.authenticatedContext('salon-a').firestore();
    await assertFails(setDoc(code(a, 'JEAN-AB12'), nouveau('salon-a', 'm2')));
    const b = env.authenticatedContext('salon-b').firestore();
    await assertFails(setDoc(code(b, 'JEAN-AB12'), nouveau('salon-b', 'n1')));
  });

  it('pas de code pour le salon d’un autre, ni pour un membre qui n’existe pas', async () => {
    const db = env.authenticatedContext('salon-b').firestore();
    await assertFails(setDoc(code(db, 'PIRATE-0001'), nouveau('salon-a', 'm1')));
    await assertFails(setDoc(code(db, 'PAUL-XY99'), nouveau('salon-b', 'fantome')));
  });

  it('un visiteur anonyme ne crée rien', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(code(db, 'ANON-0001'), nouveau('salon-a', 'm1')));
  });

  it('forme imposée : pas de champ en plus, pas de code qui commence par un tiret', async () => {
    const db = env.authenticatedContext('salon-a').firestore();
    await assertFails(setDoc(code(db, 'JEAN-ZZ11'), { ...nouveau('salon-a', 'm1'), role: 'admin' }));
    await assertFails(setDoc(code(db, '-ZZ11'), nouveau('salon-a', 'm1')));
    await assertFails(setDoc(code(db, 'jean-zz11'), nouveau('salon-a', 'm1')));
  });
});

describe('memberAccessCodes — suppression', () => {
  it('un autre salon ne retire pas le code', async () => {
    const db = env.authenticatedContext('salon-b').firestore();
    await assertFails(deleteDoc(code(db, 'JEAN-AB12')));
  });

  it('le gérant retire le code d’un de ses membres (régénération, départ)', async () => {
    const db = env.authenticatedContext('salon-a').firestore();
    await assertSucceeds(deleteDoc(code(db, 'JEAN-AB12')));
  });
});

describe('les fiches membres restent publiques', () => {
  it('la page du salon lit toujours l’équipe, et l’ancienne app sa requête par groupe', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(collection(db, 'providers/salon-a/members')));
    await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('accessCode', '==', 'X-0000'))));
  });
});
