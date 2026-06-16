/**
 * Scheduled: recomputeDashboardStats
 *
 * Runs daily and rebuilds the `stats/dashboard` doc from scratch (excluding
 * internal/test accounts, with corrected definitions). This is the source of
 * truth that heals any drift accumulated by the incremental triggers between
 * runs. The admin dashboard reads this doc.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { recomputeDashboardStats } from '../lib/dashboardStats';

export const recomputeDashboardStatsCron = onSchedule(
  {
    schedule: '0 4 * * *', // every day at 04:00
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const db = admin.firestore();
    const stats = await recomputeDashboardStats(db);
    await db.doc('stats/dashboard').set(stats, { merge: true });
    console.log(
      `[recomputeDashboardStats] users=${stats.totalUsers} providers=${stats.totalProviders} ` +
        `paying=${stats.activeProviders} bookings=${stats.totalBookings} conv=${stats.trialConversionRate}%`,
    );
  },
);
