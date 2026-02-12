import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function getOrInitApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // 1. Try FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string — recommended for Vercel)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      console.log('[FIREBASE-ADMIN] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY env var');
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (e) {
      console.error('[FIREBASE-ADMIN] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Try GOOGLE_APPLICATION_CREDENTIALS file path
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (serviceAccountPath) {
    const absolutePath = resolve(process.cwd(), serviceAccountPath);
    if (existsSync(absolutePath)) {
      const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf-8'));
      console.log('[FIREBASE-ADMIN] Initialized with service account from:', absolutePath);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    }
    console.warn(`[FIREBASE-ADMIN] Service account not found at: ${absolutePath}`);
  }

  // 3. Fallback: try common file paths relative to project (local dev)
  const commonPaths = [
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), '../../service-account.json'),
    resolve(process.cwd(), '../../../service-account.json'),
  ];

  for (const p of commonPaths) {
    if (existsSync(p)) {
      const serviceAccount = JSON.parse(readFileSync(p, 'utf-8'));
      console.log('[FIREBASE-ADMIN] Initialized with service account from:', p);
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    }
  }

  // 4. Last resort: default credentials (only works on Google Cloud infra)
  console.warn('[FIREBASE-ADMIN] No service account found. Using default credentials (will fail on Vercel).');
  return initializeApp({ projectId });
}

export function getAdminFirestore(): FirebaseFirestore.Firestore {
  getOrInitApp();
  return getFirestore();
}
