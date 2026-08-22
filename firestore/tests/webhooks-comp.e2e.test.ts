/**
 * Test de bout en bout des WEBHOOKS face aux accès offerts, sur l'émulateur
 * Firestore, en invoquant les VRAIS handlers de route Next (POST) avec des
 * événements synthétiques.
 *
 *   - RevenueCat EXPIRATION sur un compé → subscription passe à 'cancelled'
 *     (la facturation reste la vérité) mais la publication est CONSERVÉE ;
 *   - RevenueCat EXPIRATION sur un non-compé → dépublié ;
 *   - RevenueCat CANCELLATION déjà échue sur un compé → publication conservée.
 *
 * (Le webhook Stripe exige une signature ; sa garde est la MÊME fonction
 * partagée `canSystemUnpublish`, exercée ici via RevenueCat et couverte par
 * les tests unitaires — le chemin Stripe complet se vérifie avec
 * `stripe listen` en mode test, voir le plan de vérification.)
 *
 * Usage (le --tsconfig résout les alias @/ de la route) :
 *   npx firebase emulators:exec --only firestore --project wh-test \
 *     "npx tsx --tsconfig apps/web/tsconfig.json firestore/tests/webhooks-comp.e2e.test.ts"
 */
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
import admin from 'firebase-admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('À lancer via firebase emulators:exec.');
  process.exit(1);
}

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name, detail !== undefined ? `\n    reçu: ${JSON.stringify(detail)}` : ''); }
}

function rcEvent(providerId: string, type: string, extra: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/revenuecat/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: {
        type,
        app_user_id: providerId,
        product_id: 'opatam_solo_monthly',
        store: 'APP_STORE',
        environment: 'PRODUCTION',
        expiration_at_ms: Date.now() - 60_000,
        ...extra,
      },
    }),
  });
}

async function main() {
  admin.initializeApp({ projectId: 'wh-test' });
  const db = admin.firestore();

  const base = {
    plan: 'solo', isPublished: true, slug: null,
    subscription: { status: 'active', plan: 'solo', revenuecatAppUserId: 'rc_x' },
  };
  await db.collection('providers').doc('compé').set({
    ...base, businessName: 'Compé',
    accessOverride: { active: true, plan: 'solo', until: null },
  });
  await db.collection('providers').doc('ordinaire').set({ ...base, businessName: 'Ordinaire' });
  await db.collection('providers').doc('compé-cancel').set({
    ...base, businessName: 'Compé Cancel',
    accessOverride: { active: true, plan: 'team', until: null },
  });

  const { POST } = await import('../../apps/web/app/api/revenuecat/webhook/route');
  const call = (req: Request) => POST(req as never);

  let res = await call(rcEvent('compé', 'EXPIRATION'));
  check('EXPIRATION compé : 200', res.status === 200, res.status);
  const compé = (await db.collection('providers').doc('compé').get()).data()!;
  check('EXPIRATION compé : facturation mise à jour (cancelled)', compé.subscription.status === 'cancelled', compé.subscription.status);
  check('EXPIRATION compé : publication CONSERVÉE', compé.isPublished === true, compé.isPublished);

  res = await call(rcEvent('ordinaire', 'EXPIRATION'));
  const ordinaire = (await db.collection('providers').doc('ordinaire').get()).data()!;
  check('EXPIRATION ordinaire : dépublié', ordinaire.isPublished === false, ordinaire.isPublished);

  res = await call(rcEvent('compé-cancel', 'CANCELLATION'));
  const cc = (await db.collection('providers').doc('compé-cancel').get()).data()!;
  check('CANCELLATION échue compé : publication conservée', cc.isPublished === true, cc.isPublished);
  check('CANCELLATION échue compé : cancelAtPeriodEnd posé', cc.subscription.cancelAtPeriodEnd === true, cc.subscription);

  console.log(`\n${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
}

void main();
