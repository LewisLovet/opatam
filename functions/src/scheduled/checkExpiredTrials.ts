/**
 * Scheduled: checkExpiredTrials
 *
 * Runs daily at 2:00 AM (Europe/Paris) to unpublish provider pages
 * whose trial has expired. This ensures expired trial providers
 * are not visible on the public site even if they never log in.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { serverTracker } from '../utils/serverTracker';

const BATCH_SIZE = 10;

export const checkExpiredTrials = onSchedule(
  {
    schedule: '0 2 * * *', // Every day at 2:00 AM
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 120,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('checkExpiredTrials');
    console.log('=== checkExpiredTrials started ===');

    const db = admin.firestore();
    const now = Timestamp.now();

    try {
      // Query: trial providers who are still published and whose trial has expired
      const snapshot = await db
        .collection('providers')
        .where('plan', '==', 'trial')
        .where('isPublished', '==', true)
        .where('subscription.validUntil', '<', now)
        .get();

      serverTracker.trackRead('providers', snapshot.size);

      if (snapshot.empty) {
        console.log('No expired trial providers to unpublish.');
        return;
      }

      console.log(`Found ${snapshot.size} expired trial provider(s) to unpublish.`);

      // Process in batches
      const docs = snapshot.docs;
      let unpublishedCount = 0;

      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = docs.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (doc) => {
            try {
              await doc.ref.update({
                isPublished: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              serverTracker.trackWrite('providers', 1);
              unpublishedCount++;

              const data = doc.data();
              console.log(`Unpublished provider: ${doc.id} (${data.businessName})`);
            } catch (error) {
              console.error(`Error unpublishing provider ${doc.id}:`, error);
            }
          })
        );
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`=== checkExpiredTrials completed: ${unpublishedCount} unpublished in ${duration}s ===`);
      serverTracker.endContext();
    } catch (error) {
      console.error('checkExpiredTrials failed:', error);
      throw error;
    }
  }
);
