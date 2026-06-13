/**
 * Scheduled: publishScheduledNotifications
 *
 * Runs every 30 minutes. Publishes any app notification that was scheduled
 * for a past time but is not yet published.
 *
 * Mechanics: an admin can schedule a notification by saving it with
 * `isPublished: false` + `scheduledAt: <future time>`. This cron flips
 * `isPublished: true` once `scheduledAt <= now`, which:
 *   - makes it visible in the in-app notification center (the feed query
 *     filters on `isPublished == true`), and
 *   - triggers `onAppNotificationPublish` (which sends the push if
 *     `sendPush` is set, honouring each provider's centerPushEnabled).
 *
 * Precision is therefore ~30 min (the cron interval) — accepted trade-off.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const publishScheduledNotifications = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 120,
  },
  async () => {
    const db = admin.firestore();
    const now = Timestamp.now();

    // Due = scheduled in the past AND not yet published. Drafts without a
    // scheduledAt never match (the field is absent), so they stay untouched.
    const snap = await db
      .collection('appNotifications')
      .where('isPublished', '==', false)
      .where('scheduledAt', '<=', now)
      .get();

    if (snap.empty) {
      console.log('[publishScheduledNotifications] nothing due');
      return;
    }

    let published = 0;
    // Publishing flips isPublished → onAppNotificationPublish fires per doc
    // (push). Keep publishedAt = the actual publication time.
    await Promise.all(
      snap.docs.map(async (doc) => {
        try {
          await doc.ref.set(
            { isPublished: true, publishedAt: now },
            { merge: true },
          );
          published++;
        } catch (e) {
          console.error(`[publishScheduledNotifications] ${doc.id} failed:`, e);
        }
      }),
    );

    console.log(`[publishScheduledNotifications] published ${published}/${snap.size} due notification(s)`);
  },
);
