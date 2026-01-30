/**
 * Migration: Add searchTokens to existing providers
 *
 * This migration adds the searchTokens field to all existing providers
 * that don't have it yet. searchTokens is an array of normalized words
 * from the businessName used for search with array-contains.
 *
 * Run with: npx ts-node packages/firebase/src/migrations/add-search-tokens.ts
 */

import { getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, collections } from '../lib/firestore';
import { generateSearchTokens } from '@booking-app/shared';

async function migrateProviders() {
  console.log('Starting migration: add searchTokens to providers...');

  const providersRef = collections.providers();
  const snapshot = await getDocs(providersRef);

  console.log(`Found ${snapshot.docs.length} providers to process`);

  let updated = 0;
  let skipped = 0;
  const batchSize = 500;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Skip if already has searchTokens
    if (data.searchTokens && Array.isArray(data.searchTokens) && data.searchTokens.length > 0) {
      skipped++;
      continue;
    }

    // Generate search tokens from businessName
    const searchTokens = generateSearchTokens(data.businessName || '');

    if (searchTokens.length > 0) {
      const docRef = doc(db, 'providers', docSnap.id);
      batch.update(docRef, { searchTokens });
      batchCount++;
      updated++;

      // Commit batch every 500 documents
      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`Committed batch of ${batchCount} updates`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  // Commit remaining documents
  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} updates`);
  }

  console.log(`Migration complete: ${updated} providers updated, ${skipped} skipped`);
}

// Run migration
migrateProviders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
