/**
 * Règles d'écriture des surfaces d'administration.
 *
 * Ces documents alimentent des pages PUBLIQUES (vidéos et galeries de
 * l'accueil). Ils étaient ouverts à tout compte connecté : l'AdminGuard
 * React ne protège que l'interface, jamais Firebase (audit 2026-09-19).
 * Ce test fige la règle : seul un utilisateur dont le document
 * `users/{uid}.isAdmin` vaut `true` peut écrire.
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
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  // Les fiches utilisateur sont posées hors règles : c'est l'état du
  // système, pas ce qu'on teste.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin-1'), { isAdmin: true });
    await setDoc(doc(db, 'users/client-1'), { isAdmin: false });
    await setDoc(doc(db, 'landingVideos/home'), { items: [] });
    await setDoc(doc(db, 'landingGalleries/nail-artist'), { images: [] });
  });
});

after(async () => {
  await env?.cleanup();
});

const SURFACES = ['landingVideos/home', 'landingGalleries/nail-artist'];

describe('surfaces d’accueil — écriture réservée aux admins', () => {
  for (const chemin of SURFACES) {
    it(`${chemin} : un visiteur anonyme ne peut pas écrire`, async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(db, chemin), { items: ['pirate'] }));
    });

    it(`${chemin} : un compte client connecté ne peut pas écrire`, async () => {
      const db = env.authenticatedContext('client-1').firestore();
      await assertFails(setDoc(doc(db, chemin), { items: ['pirate'] }));
    });

    it(`${chemin} : un compte SANS fiche utilisateur ne peut pas écrire`, async () => {
      const db = env.authenticatedContext('inconnu-1').firestore();
      await assertFails(setDoc(doc(db, chemin), { items: ['pirate'] }));
    });

    it(`${chemin} : un admin peut écrire`, async () => {
      const db = env.authenticatedContext('admin-1').firestore();
      await assertSucceeds(setDoc(doc(db, chemin), { items: ['ok'] }));
    });

    it(`${chemin} : la lecture reste publique`, async () => {
      const db = env.unauthenticatedContext().firestore();
      const snap = await assertSucceeds(getDoc(doc(db, chemin)));
      assert.equal(snap.exists(), true);
    });
  }
});
