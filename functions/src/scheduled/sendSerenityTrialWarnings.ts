/**
 * Scheduled: sendSerenityTrialWarnings
 *
 * Daily at 10:00 (Europe/Paris — a decent hour for a commercial email).
 * Finds providers whose FREE base trial ends within WARN_WINDOW_DAYS and who
 * use the deposits feature (active Stripe Connect) without the paid Sérénité
 * add-on, and sends them ONE warning email ("your deposits stop with the
 * trial"). Guarded per-provider by `serenityTrialWarnAt`.
 *
 * Query note: single-field range on `subscription.validUntil` only (no
 * composite index needed) — paid subs whose period ends in the window also
 * match, but volumes are small and the in-memory predicate filters them out
 * (status !== 'trialing').
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { serverTracker } from '../utils/serverTracker';
import {
  shouldWarnSerenityTrialEnding,
  WARN_WINDOW_DAYS,
} from '../utils/serenityTrialWarning';
import { sendSerenityTrialEndingEmail } from '../utils/resendService';

/** Resolve the pro's email: provider doc first, then the Auth account. */
export async function resolveProviderEmail(
  providerId: string,
  data: FirebaseFirestore.DocumentData,
): Promise<string | null> {
  const fromDoc =
    (data.email as string | undefined) ||
    (data.contactEmail as string | undefined);
  if (fromDoc) return fromDoc;
  try {
    const user = await admin.auth().getUser(providerId);
    return user.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Evaluate one provider doc and send the warning if eligible.
 * Shared by the cron and the admin test callable.
 */
export async function processSerenityTrialWarning(
  doc: FirebaseFirestore.DocumentSnapshot,
  opts: { force?: boolean; dryRun?: boolean } = {},
): Promise<{ warned: boolean; reason?: string; email?: string | null }> {
  const data = doc.data();
  if (!data) return { warned: false, reason: 'no-data' };

  const validUntilRaw = data.subscription?.validUntil;
  const validUntil: Date | null =
    validUntilRaw instanceof Timestamp
      ? validUntilRaw.toDate()
      : validUntilRaw instanceof Date
        ? validUntilRaw
        : null;

  const verdict = shouldWarnSerenityTrialEnding({
    subscriptionStatus: data.subscription?.status,
    validUntil,
    stripeConnectStatus: data.stripeConnectStatus,
    depositsAddonActive: data.depositsAddonActive,
    alreadyWarned: !!data.serenityTrialWarnAt,
  });

  if (!verdict.warn && !opts.force) {
    return { warned: false, reason: verdict.warn ? undefined : verdict.reason };
  }

  const email = await resolveProviderEmail(doc.id, data);
  if (opts.dryRun) {
    return { warned: false, reason: 'dry-run', email };
  }

  if (email) {
    await sendSerenityTrialEndingEmail({
      providerEmail: email,
      businessName: (data.businessName as string | undefined) || 'Professionnel',
      trialEndsAt: validUntil ?? new Date(),
    });
  }

  // Stamp even without an email address: retrying daily would never succeed
  // and the in-app surfaces (Paiements) carry the same message anyway.
  await doc.ref.update({
    serenityTrialWarnAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  serverTracker.trackWrite('providers', 1);

  return { warned: true, email };
}

export const sendSerenityTrialWarnings = onSchedule(
  {
    schedule: '0 10 * * *', // Every day at 10:00
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 300,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('sendSerenityTrialWarnings');
    console.log('=== sendSerenityTrialWarnings started ===');

    const db = admin.firestore();
    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + WARN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const snapshot = await db
        .collection('providers')
        .where('subscription.validUntil', '>', Timestamp.fromDate(now))
        .where('subscription.validUntil', '<=', Timestamp.fromDate(windowEnd))
        .get();

      serverTracker.trackRead('providers', snapshot.size);
      console.log(`${snapshot.size} provider(s) with validUntil in the ${WARN_WINDOW_DAYS}-day window.`);

      let warnedCount = 0;
      for (const doc of snapshot.docs) {
        try {
          const result = await processSerenityTrialWarning(doc);
          if (result.warned) {
            warnedCount++;
            console.log(`Warned ${doc.id} (${doc.data()?.businessName ?? '?'}) → ${result.email ?? 'NO EMAIL'}`);
          }
        } catch (error) {
          console.error(`Error processing provider ${doc.id}:`, error);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`=== sendSerenityTrialWarnings completed: ${warnedCount} warned in ${duration}s ===`);
      serverTracker.endContext();
    } catch (error) {
      console.error('sendSerenityTrialWarnings failed:', error);
      throw error;
    }
  },
);
