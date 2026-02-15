/**
 * Scheduled: recalculateExpiredSlots
 *
 * Runs every 2 hours to recalculate nextAvailableSlot for providers
 * whose slot is expired or null.
 *
 * This is the scheduled version of the callable recalculateAllProviders.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateNextAvailableSlot } from '../utils/calculateNextAvailableSlot';
import { serverTracker } from '../utils/serverTracker';

interface ProviderResult {
  providerId: string;
  businessName: string;
  previousSlot: string | null;
  newSlot: string | null;
  changed: boolean;
  error: string | null;
}

const BATCH_SIZE = 10;

export const recalculateExpiredSlots = onSchedule(
  {
    schedule: 'every 2 hours',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 300,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('recalculateExpiredSlots');
    console.log('=== recalculateExpiredSlots started ===');

    const db = admin.firestore();
    const now = new Date();

    try {
      // 1. Retrieve only providers to recalculate

      // Providers with expired nextAvailableSlot
      const expiredSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .where('nextAvailableSlot', '<', Timestamp.fromDate(now))
        .get();
      serverTracker.trackRead('providers', expiredSnapshot.size);

      // Providers with null nextAvailableSlot (never calculated)
      const nullSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .where('nextAvailableSlot', '==', null)
        .get();
      serverTracker.trackRead('providers', nullSnapshot.size);

      // Deduplicate
      const providersToProcess = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      expiredSnapshot.docs.forEach(doc => providersToProcess.set(doc.id, doc));
      nullSnapshot.docs.forEach(doc => providersToProcess.set(doc.id, doc));

      const providerDocs = Array.from(providersToProcess.values());

      console.log(`Found ${providerDocs.length} providers to recalculate (${expiredSnapshot.size} expired, ${nullSnapshot.size} null)`);

      // Count total for skip stats
      const totalPublishedSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .count()
        .get();
      serverTracker.trackRead('providers (count)', 1);
      const totalPublished = totalPublishedSnapshot.data().count;
      const skipped = totalPublished - providerDocs.length;

      console.log(`Skipping ${skipped} providers with valid nextAvailableSlot`);

      // 2. Process a single provider
      async function processProvider(
        providerDoc: FirebaseFirestore.QueryDocumentSnapshot
      ): Promise<ProviderResult> {
        const providerId = providerDoc.id;
        const providerData = providerDoc.data();
        const businessName = providerData.businessName || 'Sans nom';
        const previousSlot = providerData.nextAvailableSlot?.toDate?.()?.toISOString() || null;

        try {
          const newSlotDate = await calculateNextAvailableSlot(providerId);
          const newSlot = newSlotDate?.toISOString() || null;

          const previousDate = previousSlot ? new Date(previousSlot).toDateString() : null;
          const newDate = newSlot ? new Date(newSlot).toDateString() : null;
          const changed = previousDate !== newDate;

          await db.collection('providers').doc(providerId).update({
            nextAvailableSlot: newSlotDate ? Timestamp.fromDate(newSlotDate) : null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          serverTracker.trackWrite('providers', 1);

          if (changed) {
            console.log(`[${businessName}] Updated: ${previousDate || 'null'} -> ${newDate || 'null'}`);
          }

          return { providerId, businessName, previousSlot, newSlot, changed, error: null };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[${businessName}] Error:`, errorMessage);
          return { providerId, businessName, previousSlot, newSlot: null, changed: false, error: errorMessage };
        }
      }

      // 3. Process in batches of 10 in parallel
      const results: ProviderResult[] = [];
      let updated = 0;
      let unchanged = 0;
      let errors = 0;

      for (let i = 0; i < providerDocs.length; i += BATCH_SIZE) {
        const batch = providerDocs.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(processProvider));

        results.push(...batchResults);
        batchResults.forEach(r => {
          if (r.error) errors++;
          else if (r.changed) updated++;
          else unchanged++;
        });

        console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(providerDocs.length / BATCH_SIZE)}`);
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`=== recalculateExpiredSlots completed in ${executionTimeMs}ms ===`);
      console.log(`Results: ${updated} updated, ${unchanged} unchanged, ${errors} errors, ${skipped} skipped`);

      serverTracker.endContext();

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error('Error in recalculateExpiredSlots:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Failed after ${executionTimeMs}ms: ${errorMessage}`);

      serverTracker.endContext();
    }
  }
);
