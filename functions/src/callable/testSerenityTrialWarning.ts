/**
 * Test Callable: testSerenityTrialWarning
 *
 * Admin-only. Runs the Sérénité J-3 warning logic for a single provider:
 *   { providerId }                    → evaluate + send if eligible
 *   { providerId, dryRun: true }      → evaluate only, report the verdict
 *   { providerId, force: true }       → bypass eligibility (window, dedupe…)
 *                                        and send — for end-to-end email tests.
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { processSerenityTrialWarning } from '../scheduled/sendSerenityTrialWarnings';

export const testSerenityTrialWarning = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new Error('Authentication required');
    }
    const db = admin.firestore();
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!callerDoc.data()?.isAdmin) {
      throw new Error('Admin access required');
    }

    const { providerId, force, dryRun } = request.data ?? {};
    if (!providerId) throw new Error('providerId is required');

    const doc = await db.collection('providers').doc(providerId).get();
    if (!doc.exists) throw new Error(`Provider ${providerId} not found`);

    const result = await processSerenityTrialWarning(doc, {
      force: !!force,
      dryRun: !!dryRun,
    });

    const data = doc.data()!;
    return {
      ...result,
      businessName: data.businessName ?? null,
      subscriptionStatus: data.subscription?.status ?? null,
      validUntil: data.subscription?.validUntil?.toDate?.()?.toISOString() ?? null,
      stripeConnectStatus: data.stripeConnectStatus ?? null,
      depositsAddonActive: !!data.depositsAddonActive,
      alreadyWarnedAt: data.serenityTrialWarnAt?.toDate?.()?.toISOString() ?? null,
    };
  },
);
