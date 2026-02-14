/**
 * Callable: recalculateAllProviders
 *
 * Parcourt les providers dont nextAvailableSlot est passé ou null
 * et met à jour leur nextAvailableSlot.
 *
 * OPTIMISATIONS :
 * 1. Ne recalcule QUE les providers dont le slot est expiré ou null
 * 2. Parallélise les calculs par batch de 10
 *
 * C'est cette fonction qui sera ensuite mise en scheduled job (toutes les heures).
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
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

interface RecalculateAllResponse {
  success: boolean;
  totalProviders: number;
  skipped: number;
  updated: number;
  unchanged: number;
  errors: number;
  results: ProviderResult[];
  executionTimeMs: number;
  message: string;
}

const BATCH_SIZE = 10;

export const recalculateAllProviders = onCall(
  { timeoutSeconds: 300 }, // 5 minutes max
  async (request: CallableRequest): Promise<RecalculateAllResponse> => {
    if (!request.auth) {
      throw new Error('Authentification requise');
    }

    const startTime = Date.now();
    serverTracker.startContext('recalculateAllProviders');
    console.log('=== recalculateAllProviders started ===');

    const db = admin.firestore();
    const now = new Date();

    try {
      // 1. Récupérer seulement les providers à recalculer

      // Providers avec nextAvailableSlot passé (expiré)
      const expiredSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .where('nextAvailableSlot', '<', Timestamp.fromDate(now))
        .get();
      serverTracker.trackRead('providers', expiredSnapshot.size);

      // Providers avec nextAvailableSlot null (jamais calculé)
      const nullSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .where('nextAvailableSlot', '==', null)
        .get();
      serverTracker.trackRead('providers', nullSnapshot.size);

      // Dédupliquer (au cas où)
      const providersToProcess = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      expiredSnapshot.docs.forEach(doc => providersToProcess.set(doc.id, doc));
      nullSnapshot.docs.forEach(doc => providersToProcess.set(doc.id, doc));

      const providerDocs = Array.from(providersToProcess.values());

      console.log(`Found ${providerDocs.length} providers to recalculate (${expiredSnapshot.size} expired, ${nullSnapshot.size} null)`);

      // Optionnel: compter le total pour savoir combien on a skip
      const totalPublishedSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .count()
        .get();
      serverTracker.trackRead('providers (count)', 1);
      const totalPublished = totalPublishedSnapshot.data().count;
      const skipped = totalPublished - providerDocs.length;

      console.log(`Skipping ${skipped} providers with valid nextAvailableSlot`);

      // 2. Fonction de traitement d'un provider
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
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
          console.error(`[${businessName}] Error:`, errorMessage);
          return { providerId, businessName, previousSlot, newSlot: null, changed: false, error: errorMessage };
        }
      }

      // 3. Traiter par batch de 10 en parallèle
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
      console.log(`=== recalculateAllProviders completed in ${executionTimeMs}ms ===`);
      console.log(`Results: ${updated} updated, ${unchanged} unchanged, ${errors} errors, ${skipped} skipped`);

      serverTracker.endContext();

      return {
        success: true,
        totalProviders: providerDocs.length,
        skipped,
        updated,
        unchanged,
        errors,
        results,
        executionTimeMs,
        message: `${providerDocs.length} providers traités (${skipped} ignorés car encore valides): ${updated} mis à jour, ${unchanged} inchangés, ${errors} erreurs`,
      };

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error('Error in recalculateAllProviders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

      serverTracker.endContext();

      return {
        success: false,
        totalProviders: 0,
        skipped: 0,
        updated: 0,
        unchanged: 0,
        errors: 1,
        results: [],
        executionTimeMs,
        message: `Erreur globale: ${errorMessage}`,
      };
    }
  }
);
