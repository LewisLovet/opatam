import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/**
 * POST /api/admin/reviews/bulk-delete-imported
 *
 * Admin-only endpoint to undo an import: deletes every imported review for
 * a given provider (optionally narrowed to a single `source`).
 *
 * We DO NOT touch provider.rating here — the `onReviewRatingUpdate` Cloud
 * Function recomputes it on every review delete.
 *
 * Body: { providerId: string, source?: string }
 * Returns: { deleted: number }
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const providerId = typeof body?.providerId === 'string' ? body.providerId.trim() : '';
    const source = typeof body?.source === 'string' && body.source.trim().length > 0 ? body.source.trim() : null;

    if (!providerId) {
      return NextResponse.json({ error: 'providerId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();

    let query: FirebaseFirestore.Query = db
      .collection('reviews')
      .where('providerId', '==', providerId)
      .where('imported', '==', true);

    if (source) {
      query = query.where('source', '==', source);
    }

    const snapshot = await query.get();

    // Batched deletes — Firestore allows up to 500 ops per batch; chunk at 450.
    let deleted = 0;
    const commits: Promise<unknown>[] = [];
    let batch = db.batch();
    let opsInBatch = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      deleted++;
      opsInBatch++;
      if (opsInBatch >= 450) {
        commits.push(batch.commit());
        batch = db.batch();
        opsInBatch = 0;
      }
    });

    if (opsInBatch > 0) commits.push(batch.commit());
    await Promise.all(commits);

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('[admin/reviews/bulk-delete-imported] Error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
