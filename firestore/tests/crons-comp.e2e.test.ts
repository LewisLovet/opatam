/**
 * Test de bout en bout des CRONS face aux accès offerts, sur l'émulateur
 * Firestore, en invoquant les VRAIS handlers (CloudFunction.run() de
 * firebase-functions v2) — pas une réimplémentation de leur logique.
 *
 * Scénarios :
 *   - checkExpiredTrials : un essai expiré COMPÉ n'est pas dépublié,
 *     un essai expiré ordinaire l'est ;
 *   - sendSubscriptionReminders : un compé ne reçoit aucun rappel
 *     « votre essai expire » (aucune trace expiryRemindersSent).
 *
 * Usage : npx firebase emulators:exec --only firestore --project cron-test \
 *          "npx tsx firestore/tests/crons-comp.e2e.test.ts"
 */
import admin from 'firebase-admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('À lancer via firebase emulators:exec.');
  process.exit(1);
}
admin.initializeApp({ projectId: 'cron-test' });
const db = admin.firestore();

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name, detail !== undefined ? `\n    reçu: ${JSON.stringify(detail)}` : ''); }
}

async function main() {
  const past = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 864e5));

  // Deux essais expirés et publiés — seul le premier a un accès offert.
  await db.collection('providers').doc('compé').set({
    businessName: 'Compé', plan: 'trial', isPublished: true,
    subscription: { status: 'trialing', plan: 'trial', validUntil: past },
    accessOverride: { active: true, plan: 'solo', until: null },
  });
  await db.collection('providers').doc('ordinaire').set({
    businessName: 'Ordinaire', plan: 'trial', isPublished: true,
    subscription: { status: 'trialing', plan: 'trial', validUntil: past },
  });

  // Import APRÈS initializeApp : les modules functions appellent
  // admin.firestore() à l'exécution du handler.
  const { checkExpiredTrials } = await import('../../functions/src/scheduled/checkExpiredTrials');
  await (checkExpiredTrials as { run: (e: unknown) => Promise<unknown> }).run({
    scheduleTime: new Date().toISOString(),
  });

  const compé = (await db.collection('providers').doc('compé').get()).data()!;
  const ordinaire = (await db.collection('providers').doc('ordinaire').get()).data()!;
  check('essai expiré COMPÉ : publication conservée', compé.isPublished === true, compé.isPublished);
  check('essai expiré ordinaire : dépublié', ordinaire.isPublished === false, ordinaire.isPublished);

  // Rappels d'abonnement : le compé ne doit recevoir AUCUN rappel.
  // (L'« ordinaire » vient d'être dépublié mais reste trialing → le cron le
  // verrait ; son envoi d'e-mail échouera sans clé Resend, ce qui est
  // attendu et sans effet sur l'assertion du compé.)
  const { sendSubscriptionReminders } = await import('../../functions/src/scheduled/sendSubscriptionReminders');
  await (sendSubscriptionReminders as { run: (e: unknown) => Promise<unknown> }).run({
    scheduleTime: new Date().toISOString(),
  }).catch((e: unknown) => {
    console.log('  (info) run sendSubscriptionReminders:', (e as Error).message?.slice(0, 80));
  });

  const compéApres = (await db.collection('providers').doc('compé').get()).data()!;
  check(
    'compé : aucun rappel « essai expiré » enregistré',
    !compéApres.expiryRemindersSent || compéApres.expiryRemindersSent.length === 0,
    compéApres.expiryRemindersSent,
  );

  console.log(`\n${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
}

void main();
