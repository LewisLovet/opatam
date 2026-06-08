/**
 * Trigger: onAppNotificationPublish
 *
 * Fires on writes to `appNotifications/{id}`. When an announcement is
 * published with `sendPush` enabled (and hasn't been pushed yet), sends
 * an Expo push to the target audience, then stamps `pushedAt` so the
 * push is dispatched exactly once (the stamp re-fires this trigger but
 * the guard short-circuits).
 *
 * Audience → recipients:
 *   - 'pros'    : users with role 'provider'
 *   - 'clients' : users with role 'client'
 *   - 'all'     : every user that has push tokens
 *
 * Tap routing is handled mobile-side (useNotifications) via
 * data.type === 'app_notification'.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendPushNotifications } from '../utils/expoPushService';

export const onAppNotificationPublish = onDocumentWritten(
  {
    document: 'appNotifications/{notificationId}',
    region: 'europe-west1',
  },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return; // deleted

    // Guards: only published + push-requested + not-yet-pushed.
    if (!after.isPublished || !after.sendPush || after.pushedAt) return;

    const db = admin.firestore();
    const notificationId = event.params.notificationId;
    const audience: string = after.audience || 'pros';

    try {
      // Resolve recipient user docs by audience.
      let usersSnap;
      if (audience === 'all') {
        usersSnap = await db.collection('users').get();
      } else {
        const role = audience === 'clients' ? 'client' : 'provider';
        usersSnap = await db.collection('users').where('role', '==', role).get();
      }

      // Collect + dedupe push tokens.
      const tokenSet = new Set<string>();
      usersSnap.forEach((doc) => {
        const tokens: string[] = doc.data()?.pushTokens || [];
        tokens.forEach((t) => t && tokenSet.add(t));
      });
      const tokens = Array.from(tokenSet);

      if (tokens.length > 0) {
        await sendPushNotifications(tokens, {
          title: after.title || 'Opatam',
          body: after.body || '',
          data: {
            type: 'app_notification',
            notificationId,
            articleSlug: after.ctaArticleSlug || null,
          },
        });
        console.log(
          `[onAppNotificationPublish] ${notificationId}: pushed to ${tokens.length} token(s) (audience=${audience})`,
        );
      } else {
        console.log(`[onAppNotificationPublish] ${notificationId}: no tokens for audience=${audience}`);
      }
    } catch (error) {
      console.error(`[onAppNotificationPublish] ${notificationId} failed:`, error);
    } finally {
      // Always stamp pushedAt so we never double-send, even on partial
      // failure (avoids a retry storm spamming users).
      await db
        .collection('appNotifications')
        .doc(notificationId)
        .set({ pushedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .catch((e) => console.error('[onAppNotificationPublish] stamp failed:', e));
    }
  },
);
