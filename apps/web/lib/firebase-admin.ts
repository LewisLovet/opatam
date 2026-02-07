import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function getOrInitApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Try to load service account from env variable or common paths
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    // Resolve relative to cwd or use absolute path
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

  // Fallback: try common paths relative to project
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

  // In production (Vercel, Cloud Run), ADC or managed credentials are used
  console.log('[FIREBASE-ADMIN] Initialized with default credentials (no service account file found)');
  return initializeApp({ projectId });
}

export function getAdminFirestore(): FirebaseFirestore.Firestore {
  getOrInitApp();
  return getFirestore();
}
