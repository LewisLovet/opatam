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
 *   - 'pros'     : users with role 'provider'
 *   - 'clients'  : users with role 'client'
 *   - 'admins'   : users with isAdmin === true
 *   - 'all'      : every user that has push tokens
 *   - 'specific' : the single user in `targetUserId`
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
      // Collect + dedupe push tokens for the audience.
      const tokenSet = new Set<string>();
      const collect = (snap: FirebaseFirestore.QuerySnapshot | FirebaseFirestore.DocumentSnapshot) => {
        const docs = 'docs' in snap ? snap.docs : [snap];
        docs.forEach((doc) => {
          const tokens: string[] = doc.data()?.pushTokens || [];
          tokens.forEach((t) => t && tokenSet.add(t));
        });
      };

      // Providers who turned OFF push for the notification center (explicit
      // `false`). Only relevant for provider-targeted audiences. We exclude
      // their tokens so the per-user toggle is honoured.
      const centerPushOff = new Set<string>();
      if (audience === 'specific' || audience === 'pros') {
        try {
          const offSnap = await db
            .collection('providers')
            .where('settings.notificationPreferences.centerPushEnabled', '==', false)
            .get();
          offSnap.forEach((d) => centerPushOff.add(d.id));
        } catch (e) {
          console.warn('[onAppNotificationPublish] centerPush pref query failed:', e);
        }
      }

      if (audience === 'specific') {
        const targetUserId: string | undefined = after.targetUserId || undefined;
        if (targetUserId && !centerPushOff.has(targetUserId)) {
          collect(await db.collection('users').doc(targetUserId).get());
        }
      } else if (audience === 'all') {
        collect(await db.collection('users').get());
      } else if (audience === 'admins') {
        collect(await db.collection('users').where('isAdmin', '==', true).get());
      } else {
        const role = audience === 'clients' ? 'client' : 'provider';
        const snap = await db.collection('users').where('role', '==', role).get();
        if (role === 'provider' && centerPushOff.size > 0) {
          snap.docs.forEach((doc) => {
            if (!centerPushOff.has(doc.id)) collect(doc);
          });
        } else {
          collect(snap);
        }
      }

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
