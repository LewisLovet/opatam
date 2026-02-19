/**
 * Callable: testAggregatePageViews
 *
 * Wrapper callable to manually trigger the page views aggregation.
 * For testing purposes only — the real function runs on schedule at 01:00.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { serverTracker } from '../utils/serverTracker';

interface ProviderDetail {
  providerId: string;
  businessName: string;
  todayViews: number;
  previousTotal: number;
  newTotal: number;
  last7Days: number;
  last30Days: number;
}

interface AggregatePageViewsResult {
  success: boolean;
  providersProcessed: number;
  skipped: number;
  oldDocsDeleted: number;
  details: ProviderDetail[];
  executionTimeMs: number;
  message: string;
}

function getDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const testAggregatePageViews = onCall(
  { timeoutSeconds: 300 },
  async (request: CallableRequest<{ providerId?: string }>): Promise<AggregatePageViewsResult> => {
    // Auth check skipped — this callable only runs in emulator mode

    const targetProviderId = request.data?.providerId?.trim() || null;

    const startTime = Date.now();
    serverTracker.startContext('testAggregatePageViews');
    console.log(`=== testAggregatePageViews started ${targetProviderId ? `for provider ${targetProviderId}` : '(all providers)'} ===`);

    const db = admin.firestore();

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateStr(yesterday);

    const last7Date = new Date(now);
    last7Date.setDate(last7Date.getDate() - 7);
    const last7Str = getDateStr(last7Date);

    const last30Date = new Date(now);
    last30Date.setDate(last30Date.getDate() - 30);
    const last30Str = getDateStr(last30Date);

    const details: ProviderDetail[] = [];
    let processed = 0;
    let skipped = 0;

    try {
      let providerDocs: FirebaseFirestore.QueryDocumentSnapshot[];

      if (targetProviderId) {
        const providerDoc = await db.collection('providers').doc(targetProviderId).get();
        serverTracker.trackRead('providers', 1);
        if (!providerDoc.exists) {
          serverTracker.endContext();
          return {
            success: false,
            providersProcessed: 0,
            skipped: 0,
            oldDocsDeleted: 0,
            details: [],
            executionTimeMs: Date.now() - startTime,
            message: `Provider ${targetProviderId} non trouvé`,
          };
        }
        providerDocs = [providerDoc as unknown as FirebaseFirestore.QueryDocumentSnapshot];
      } else {
        const providersSnap = await db.collection('providers')
          .where('isPublished', '==', true)
          .get();
        serverTracker.trackRead('providers', providersSnap.size);
        providerDocs = providersSnap.docs;
      }

      console.log(`Found ${providerDocs.length} providers to process`);

      const BATCH_SIZE = 10;
      for (let i = 0; i < providerDocs.length; i += BATCH_SIZE) {
        const batch = providerDocs.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (providerDoc) => {
          const providerId = providerDoc.id;
          const data = providerDoc.data();
          const businessName = data?.businessName || 'Sans nom';
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
                count: FieldValue.increment(todayViews),
              }, { merge: true });
              serverTracker.trackWrite('pageViewsDaily', 1);
            }

            // 2. Query daily docs for last 30 days
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

            // 3. Update provider
            const newTotal = currentTotal + todayViews;
            await db.collection('providers').doc(providerId).update({
              'stats.pageViews.total': newTotal,
              'stats.pageViews.today': 0,
              'stats.pageViews.last7Days': last7Days,
              'stats.pageViews.last30Days': last30Days,
            });
            serverTracker.trackWrite('providers', 1);

            details.push({
              providerId,
              businessName,
              todayViews,
              previousTotal: currentTotal,
              newTotal,
              last7Days,
              last30Days,
            });

            processed++;
          } catch (err) {
            console.error(`Error processing provider ${providerId}:`, err);
          }
        }));
      }

      // 4. Cleanup old daily docs (>90 days)
      const cleanupDate = new Date(now);
      cleanupDate.setDate(cleanupDate.getDate() - 90);
      const cleanupStr = getDateStr(cleanupDate);

      const oldDocsSnap = await db.collection('pageViewsDaily')
        .where('date', '<', cleanupStr)
        .limit(500)
        .get();
      serverTracker.trackRead('pageViewsDaily', oldDocsSnap.size);

      let oldDocsDeleted = 0;
      if (oldDocsSnap.size > 0) {
        const writeBatch = db.batch();
        for (const oldDoc of oldDocsSnap.docs) {
          writeBatch.delete(oldDoc.ref);
        }
        await writeBatch.commit();
        serverTracker.trackWrite('pageViewsDaily', oldDocsSnap.size);
        oldDocsDeleted = oldDocsSnap.size;
        console.log(`Cleaned up ${oldDocsSnap.size} old daily docs`);
      }

      const executionTimeMs = Date.now() - startTime;
      serverTracker.endContext();
      console.log(`=== testAggregatePageViews done in ${((executionTimeMs) / 1000).toFixed(1)}s ===`);
      console.log(`Processed: ${processed}, Skipped: ${skipped}`);

      return {
        success: true,
        providersProcessed: processed,
        skipped,
        oldDocsDeleted,
        details,
        executionTimeMs,
        message: `${processed} providers traités, ${skipped} ignorés, ${oldDocsDeleted} anciens docs supprimés`,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      serverTracker.endContext();

      return {
        success: false,
        providersProcessed: 0,
        skipped: 0,
        oldDocsDeleted: 0,
        details: [],
        executionTimeMs,
        message: `Erreur: ${errorMessage}`,
      };
    }
  }
);
