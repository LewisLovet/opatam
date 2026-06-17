import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase configuration from environment variables
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Get or initialize Firebase app instance
 */
export function getFirebaseApp(): FirebaseApp {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  return initializeApp(firebaseConfig);
}

/**
 * Firebase app instance (singleton)
 */
export const app = getFirebaseApp();

/**
 * Firestore instance (singleton), initialized with auto-detect long-polling.
 *
 * WHY: the default WebChannel streaming transport for real-time listeners
 * (`onSnapshot` → `Listen/channel`) fails under Safari's stricter network /
 * ITP rules ("Fetch API cannot load … due to access control checks"), which
 * makes Safari slow and flaky. `experimentalAutoDetectLongPolling` detects
 * those environments (Safari, restrictive proxies) and falls back to
 * long-polling there, while keeping fast streaming where it works (Chrome…).
 *
 * Must run BEFORE any `getFirestore(app)` call — this module is the base
 * import of every repository, so it does. The try/catch reuses the instance
 * if Firestore was already started (HMR / double import).
 */
function initDb(): Firestore {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return getFirestore(app);
  }
}

export const db = initDb();
