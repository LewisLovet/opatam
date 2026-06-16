/**
 * Callable: recomputeDashboardStatsNow
 *
 * Admin-only on-demand recompute of `stats/dashboard` (the "Recalculer les
 * stats" button on the admin dashboard). Same logic as the daily cron.
 *
 *   const fn = httpsCallable(functions, 'recomputeDashboardStatsNow');
 *   const { data } = await fn();
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { recomputeDashboardStats } from '../lib/dashboardStats';

export const recomputeDashboardStatsNow = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const db = admin.firestore();
    const callerDoc = await db.collection('users').doc(req.auth.uid).get();
    if (callerDoc.data()?.isAdmin !== true) {
      throw new HttpsError('permission-denied', 'Admin only');
    }

    const stats = await recomputeDashboardStats(db);
    await db.doc('stats/dashboard').set(stats, { merge: true });
    return { ok: true, stats };
  },
);
