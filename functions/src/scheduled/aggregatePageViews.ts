/**
 * Scheduled: aggregatePageViews
 *
 * Runs every day at 01:00 (Europe/Paris) to:
 * 1. Save yesterday's `stats.pageViews.today` into a daily document
 * 2. Recalculate `last7Days` and `last30Days` from daily documents
 * 3. Add `today` to `total` and reset `today` to 0
 * 4. Roll yesterday's count into pageViewsMonthly so we keep an
 *    indefinite-retention monthly history (the daily collection
 *    is pruned at 90 days — see step 5). The /pro/statistiques
 *    12-month chart reads from pageViewsMonthly.
 * 5. Cleanup daily docs older than 90 days
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
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
    // We want the last 7 completed days (yesterday included) = days -1 to -7
    // and last 30 completed days = days -1 to -30
    // Since we query with >=, use day -6 and day -29 (relative to yesterday)
    const last7Date = new Date(yesterday);
    last7Date.setDate(last7Date.getDate() - 6);
    const last7Str = getDateStr(last7Date);

    const last30Date = new Date(yesterday);
    last30Date.setDate(last30Date.getDate() - 29);
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
        const providerRef = db.collection('providers').doc(providerId);
        const monthStr = yesterdayStr.slice(0, 7); // YYYY-MM
        const dailyRef = db.collection('pageViewsDaily').doc(`${providerId}_${yesterdayStr}`);
        const monthlyRef = db.collection('pageViewsMonthly').doc(`${providerId}_${monthStr}`);
        const dailyQuery = db.collection('pageViewsDaily')
          .where('providerId', '==', providerId)
          .where('date', '>=', last30Str);

        try {
          // TOUT dans UNE transaction par prestataire.
          //
          // Auparavant : garde lue sur un instantané déjà ancien, puis
          // quatre écritures indépendantes. Deux exécutions concurrentes
          // passaient donc la garde toutes les deux, et une panne entre les
          // incréments journaliers et la remise à zéro de `today` faisait
          // recompter les mêmes vues le lendemain. La transaction rend
          // l'opération atomique et Firestore rejoue en cas de conflit :
          // la journée est comptée une fois, ou pas du tout.
          //
          // Contrainte Firestore : TOUTES les lectures avant TOUTES les
          // écritures — d'où le calcul de last7/last30 en mémoire.
          const issue = await db.runTransaction(async (tx) => {
            const frais = await tx.get(providerRef);
            const pv = frais.data()?.stats?.pageViews ?? {};
            if (pv.lastAggregatedDate === yesterdayStr) return 'skipped';

            const todayViews: number = pv.today ?? 0;
            const storyToday: number = pv.storyToday ?? 0;
            const currentTotal: number = pv.total ?? 0;
            if (todayViews === 0 && currentTotal === 0) return 'skipped';

            const dailySnap = await tx.get(dailyQuery);

            let last7Days = 0;
            let last30Days = 0;
            for (const dailyDoc of dailySnap.docs) {
              const d = dailyDoc.data();
              const count = d.count ?? 0;
              last30Days += count;
              if (d.date >= last7Str) last7Days += count;
            }
            // Les vues d'hier ne sont pas encore dans les documents lus :
            // hier appartient aux deux fenêtres, on l'ajoute aux deux.
            last7Days += todayViews;
            last30Days += todayViews;

            if (todayViews > 0) {
              tx.set(dailyRef, {
                providerId,
                date: yesterdayStr,
                count: FieldValue.increment(todayViews),
                ...(storyToday > 0 ? { storyCount: FieldValue.increment(storyToday) } : {}),
              }, { merge: true });

              // Compteur mensuel, conservé sans limite de durée.
              tx.set(monthlyRef, {
                providerId,
                month: monthStr,
                count: FieldValue.increment(todayViews),
                updatedAt: FieldValue.serverTimestamp(),
              }, { merge: true });
            }

            // Incréments RELATIFS sur le prestataire : une vue arrivée
            // pendant la transaction n'est ni perdue ni doublée.
            tx.update(providerRef, {
              'stats.pageViews.total': FieldValue.increment(todayViews),
              'stats.pageViews.today': FieldValue.increment(-todayViews),
              'stats.pageViews.storyTotal': FieldValue.increment(storyToday),
              'stats.pageViews.storyToday': FieldValue.increment(-storyToday),
              'stats.pageViews.last7Days': last7Days,
              'stats.pageViews.last30Days': last30Days,
              'stats.pageViews.lastAggregatedDate': yesterdayStr,
            });
            return 'processed';
          });

          if (issue === 'skipped') {
            skipped++;
            return;
          }
          serverTracker.trackWrite('providers', 1);
          serverTracker.trackWrite('pageViewsDaily', 1);
          serverTracker.trackWrite('pageViewsMonthly', 1);
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
