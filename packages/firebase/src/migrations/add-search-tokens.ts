/**
 * Migration: Add searchTokens to existing providers
 *
 * This migration adds the searchTokens field to all existing providers
 * that don't have it yet. searchTokens is an array of normalized words
 * from the businessName used for search with array-contains.
 *
 * Run from packages/firebase with: npx tsx src/migrations/add-search-tokens.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Firebase config - copy your values here or use env vars
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Generate search tokens with prefixes (copied from shared utils)
function generateSearchTokens(businessName: string): string[] {
  const words = businessName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ''))
    .filter((word) => word.length >= 3);

  const tokens = new Set<string>();

  for (const word of words) {
    // Add all prefixes from 3 chars to full word
    for (let i = 3; i <= word.length; i++) {
      tokens.add(word.slice(0, i));
    }
  }

  return Array.from(tokens);
}

async function migrateProviders() {
  console.log('Starting migration: add searchTokens to providers...');
  console.log('Project ID:', firebaseConfig.projectId);

  if (!firebaseConfig.projectId) {
    console.error('ERROR: Firebase project ID not configured. Set FIREBASE_PROJECT_ID or EXPO_PUBLIC_FIREBASE_PROJECT_ID env var.');
    process.exit(1);
  }

  const providersRef = collection(db, 'providers');
  const snapshot = await getDocs(providersRef);

  console.log(`Found ${snapshot.docs.length} providers to process`);

  let updated = 0;
  let skipped = 0;
  const batchSize = 500;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Force update all providers to include prefixes
    // (Previously only stored full words, now we need prefixes too)

    // Generate search tokens from businessName
    const searchTokens = generateSearchTokens(data.businessName || '');

    if (searchTokens.length > 0) {
      console.log(`  Updating ${data.businessName} with tokens: [${searchTokens.join(', ')}]`);
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

  console.log(`\nMigration complete: ${updated} providers updated, ${skipped} skipped`);
}

// Run migration
migrateProviders()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
