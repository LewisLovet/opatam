/**
 * Scheduled: aggregatePageViews
 *
 * Runs every day at 01:00 (Europe/Paris) to:
 * 1. Save yesterday's `stats.pageViews.today` into a daily document
 * 2. Recalculate `last7Days` and `last30Days` from daily documents
 * 3. Add `today` to `total` and reset `today` to 0
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { serverTracker } from '../utils/serverTracker';

const BATCH_SIZE = 10;

function getDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const aggregatePageViews = onSchedule(
  {
    schedule: 'every day 01:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 300,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('aggregatePageViews');
    console.log('=== aggregatePageViews started ===');

    const db = admin.firestore();

    // Yesterday's date string (the day we're archiving)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateStr(yesterday);

    // Date boundaries for last7/last30 days
    const last7Date = new Date(now);
    last7Date.setDate(last7Date.getDate() - 7);
    const last7Str = getDateStr(last7Date);

    const last30Date = new Date(now);
    last30Date.setDate(last30Date.getDate() - 30);
    const last30Str = getDateStr(last30Date);

    // Get all providers with page views
    const providersSnap = await db.collection('providers')
      .where('isPublished', '==', true)
      .get();
    serverTracker.trackRead('providers', providersSnap.size);

    console.log(`Found ${providersSnap.size} published providers`);

    let processed = 0;
    let skipped = 0;

    // Process in batches
    const providerDocs = providersSnap.docs;
    for (let i = 0; i < providerDocs.length; i += BATCH_SIZE) {
      const batch = providerDocs.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (providerDoc) => {
        const providerId = providerDoc.id;
        const data = providerDoc.data();
        const todayViews = data?.stats?.pageViews?.today ?? 0;
        const currentTotal = data?.stats?.pageViews?.total ?? 0;

        if (todayViews === 0 && currentTotal === 0) {
          skipped++;
          return;
        }

        try {
          // 1. Save yesterday's views into daily doc (increment to handle multiple calls)
          if (todayViews > 0) {
            const dailyDocId = `${providerId}_${yesterdayStr}`;
            await db.collection('pageViewsDaily').doc(dailyDocId).set({
              providerId,
              date: yesterdayStr,
              count: admin.firestore.FieldValue.increment(todayViews),
            }, { merge: true });
            serverTracker.trackWrite('pageViewsDaily', 1);
          }

          // 2. Query daily docs for last 30 days to recalculate
          const dailySnap = await db.collection('pageViewsDaily')
            .where('providerId', '==', providerId)
            .where('date', '>=', last30Str)
            .get();
          serverTracker.trackRead('pageViewsDaily', dailySnap.size);

          let last7Days = 0;
          let last30Days = 0;

          for (const dailyDoc of dailySnap.docs) {
            const d = dailyDoc.data();
            const count = d.count ?? 0;
            last30Days += count;
            if (d.date >= last7Str) {
              last7Days += count;
            }
          }

          // 3. Update provider: total += today, reset today, set last7/30
          const newTotal = currentTotal + todayViews;
          await db.collection('providers').doc(providerId).update({
            'stats.pageViews.total': newTotal,
            'stats.pageViews.today': 0,
            'stats.pageViews.last7Days': last7Days,
            'stats.pageViews.last30Days': last30Days,
          });
          serverTracker.trackWrite('providers', 1);

          processed++;
        } catch (err) {
          console.error(`Error processing provider ${providerId}:`, err);
        }
      }));
    }

    // 4. Cleanup: delete daily docs older than 90 days
    const cleanupDate = new Date(now);
    cleanupDate.setDate(cleanupDate.getDate() - 90);
    const cleanupStr = getDateStr(cleanupDate);

    const oldDocsSnap = await db.collection('pageViewsDaily')
      .where('date', '<', cleanupStr)
      .limit(500)
      .get();
    serverTracker.trackRead('pageViewsDaily', oldDocsSnap.size);

    if (oldDocsSnap.size > 0) {
      const writeBatch = db.batch();
      for (const oldDoc of oldDocsSnap.docs) {
        writeBatch.delete(oldDoc.ref);
      }
      await writeBatch.commit();
      serverTracker.trackWrite('pageViewsDaily', oldDocsSnap.size);
      console.log(`Cleaned up ${oldDocsSnap.size} old daily docs`);
    }

    serverTracker.endContext();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== aggregatePageViews done in ${duration}s ===`);
    console.log(`Processed: ${processed}, Skipped: ${skipped}`);
  }
);
