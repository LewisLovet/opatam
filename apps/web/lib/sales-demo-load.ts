import { getAdminFirestore } from '@/lib/firebase-admin';
import { demoConfigStoredSchema, type DemoConfig } from '@/lib/sales-demo';

/**
 * Charge une démo personnalisée pour le rendu des pages /p/demo-<id>.
 *
 * Admin SDK côté serveur : la collection est fermée au SDK client — le
 * prospect n'est pas authentifié, c'est la page qui lit pour lui.
 * L'expiration (30 j) se juge À CHAQUE rendu : un lien périmé rend null,
 * même si le document existe encore.
 */
export interface LoadedDemo {
  config: DemoConfig;
  staffUid: string;
}

export async function loadDemo(demoId: string): Promise<LoadedDemo | null> {
  if (!/^[A-Za-z0-9]{10,30}$/.test(demoId)) return null;
  const snap = await getAdminFirestore().collection('salesDemoLinks').doc(demoId).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const expiresAt = data.expiresAt?.toDate?.()?.getTime() ?? 0;
  if (expiresAt < Date.now()) return null;
  // Schéma de LECTURE : les prix stockés sont DÉJÀ en centimes.
  const parsed = demoConfigStoredSchema.safeParse(data.config);
  if (!parsed.success) return null;
  return { config: parsed.data, staffUid: data.staffUid ?? '' };
}

/** `/p/demo-abc123` → 'abc123', sinon null. Le slug 'demo' nu reste la
 *  démo générique et ne passe pas par ici. */
export function demoIdFromSlug(slug: string): string | null {
  const m = /^demo-([A-Za-z0-9]{10,30})$/.exec(slug);
  return m ? m[1] : null;
}
