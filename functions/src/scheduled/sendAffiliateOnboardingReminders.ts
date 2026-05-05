/**
 * Scheduled: sendAffiliateOnboardingReminders
 *
 * Runs daily at 10:00 AM (Europe/Paris) and pings any active
 * affiliate whose Stripe Connect account is incomplete (status
 * `pending` or `restricted`). The email includes a magic link that
 * points to /affiliation/finalize?token=…, which generates a fresh
 * Stripe AccountLink on click (the link itself only lives 5 min,
 * so the indirection is necessary).
 *
 * Cadence: each affiliate gets at most one reminder every 14 days.
 * The dedupe is `onboardingReminderLastSent` on the affiliate doc.
 *
 * Active affiliates with `stripeAccountStatus == 'active'` are
 * filtered out at the query level.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { sendAffiliateOnboardingReminder } from '../notifications/affiliateOnboarding';

const REMINDER_INTERVAL_DAYS = 14;

export const sendAffiliateOnboardingReminders = onSchedule(
  {
    schedule: '0 10 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 120,
  },
  async () => {
    console.log('=== sendAffiliateOnboardingReminders started ===');
    const db = admin.firestore();
    const now = new Date();
    const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000);

    // Fetch only the affiliates we might actually email.
    // We grab `pending` and `restricted` separately because Firestore
    // can't OR over the same field with `in` while also filtering on
    // `isActive`, but we're well below the cap anyway.
    const [pendingSnap, restrictedSnap] = await Promise.all([
      db
        .collection('affiliates')
        .where('isActive', '==', true)
        .where('stripeAccountStatus', '==', 'pending')
        .get(),
      db
        .collection('affiliates')
        .where('isActive', '==', true)
        .where('stripeAccountStatus', '==', 'restricted')
        .get(),
    ]);

    const candidates = [...pendingSnap.docs, ...restrictedSnap.docs];
    console.log(`Found ${candidates.length} affiliate(s) with incomplete Connect (pending/restricted)`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of candidates) {
      const data = doc.data();
      const lastSent = data.onboardingReminderLastSent?.toDate?.();
      if (lastSent && lastSent > cutoff) {
        skipped++;
        continue;
      }

      try {
        const result = await sendAffiliateOnboardingReminder(doc.id);
        if (result.success) {
          sent++;
          console.log(
            `[affiliateOnboarding] sent to ${data.name} (${doc.id}, ${data.stripeAccountStatus})`,
          );
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
        console.error(`[affiliateOnboarding] failed for ${doc.id}:`, err);
      }
    }

    console.log(
      `=== sendAffiliateOnboardingReminders done — sent: ${sent}, skipped: ${skipped}, errors: ${errors} ===`,
    );
  },
);
