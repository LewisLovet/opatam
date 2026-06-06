import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Global mobile-app config (update gate / maintenance).
 * Stored at Firestore `config/mobile`. Read publicly by the app; written only
 * here, gated by the admin check (same pattern as the other /api/admin routes).
 */

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

// GET — current config (admin UI prefill).
export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('config').doc('mobile').get();
    return NextResponse.json({ config: snap.exists ? snap.data() : null });
  } catch (err: any) {
    console.error('[admin/app-config] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — upsert config.
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const str = (v: unknown): string | null =>
      typeof v === 'string' && v.trim() ? v.trim() : null;

    const data = {
      minSupportedVersion: str(body.minSupportedVersion) ?? '0.0.0',
      latestVersion: str(body.latestVersion),
      forceUpdate: !!body.forceUpdate,
      maintenance: !!body.maintenance,
      message: str(body.message),
      iosStoreUrl: str(body.iosStoreUrl),
      androidStoreUrl: str(body.androidStoreUrl),
      updatedAt: new Date(),
    };

    const db = getAdminFirestore();
    await db.collection('config').doc('mobile').set(data, { merge: true });
    return NextResponse.json({ ok: true, config: data });
  } catch (err: any) {
    console.error('[admin/app-config] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
