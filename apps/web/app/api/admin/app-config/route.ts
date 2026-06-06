import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Global mobile-app config (update gate / maintenance).
 * Stored at Firestore `config/mobile`. Read publicly by the app; written only
 * here, gated by the admin check (same pattern as the other /api/admin routes).
 */

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/** Descending semver compare (b vs a) so the newest version sorts first. */
function compareDesc(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  }
  return 0;
}

/** Best-effort read of the mobile app.json version (suggestion in the admin UI). */
function readCurrentAppVersion(): string | null {
  const candidates = [
    path.join(process.cwd(), '../../apps/mobile/app.json'),
    path.join(process.cwd(), 'apps/mobile/app.json'),
    path.join(process.cwd(), '../mobile/app.json'),
  ];
  for (const p of candidates) {
    try {
      const json = JSON.parse(readFileSync(p, 'utf8'));
      const v = json?.expo?.version;
      if (typeof v === 'string' && SEMVER_RE.test(v)) return v;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

// GET — current config + current app version (admin UI prefill).
export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('config').doc('mobile').get();
    return NextResponse.json({
      config: snap.exists ? snap.data() : null,
      currentAppVersion: readCurrentAppVersion(),
    });
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

    // Curated list of released versions — deduped, semver-validated, newest first.
    const releasedVersions = Array.isArray(body.releasedVersions)
      ? Array.from(
          new Set(
            body.releasedVersions
              .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
              .filter((v: string) => SEMVER_RE.test(v))
          )
        ).sort(compareDesc as (a: unknown, b: unknown) => number)
      : [];

    const minSupportedVersion = str(body.minSupportedVersion) ?? '0.0.0';
    if (!SEMVER_RE.test(minSupportedVersion)) {
      return NextResponse.json(
        { error: 'Version minimale invalide (format x.y.z)' },
        { status: 400 }
      );
    }

    const latestVersion = str(body.latestVersion);
    if (latestVersion && !SEMVER_RE.test(latestVersion)) {
      return NextResponse.json(
        { error: 'Dernière version invalide (format x.y.z)' },
        { status: 400 }
      );
    }

    // Structured release notes (features / fixes) — trimmed, non-empty, capped.
    const cleanList = (v: unknown): string[] =>
      Array.isArray(v)
        ? v
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
            .slice(0, 20)
        : [];
    const releaseNotes = {
      features: cleanList(body.releaseNotes?.features),
      fixes: cleanList(body.releaseNotes?.fixes),
    };

    const data = {
      minSupportedVersion,
      latestVersion,
      releasedVersions,
      forceUpdate: !!body.forceUpdate,
      maintenance: !!body.maintenance,
      message: str(body.message),
      releaseNotes,
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
