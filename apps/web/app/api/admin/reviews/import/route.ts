import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { importReviewsSchema } from '@booking-app/shared';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

function clampRating(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)));
}

/**
 * POST /api/admin/reviews/import
 *
 * Admin-only endpoint to bulk-import external reviews (e.g. from a
 * competitor's export) for a given provider. Each created review:
 *   - is anonymous (no client identity is ever imported),
 *   - has `isPublic: true` + an integer rating 1..5, so the
 *     `onReviewRatingUpdate` Cloud Function auto-counts it and the
 *     integer distribution stays intact,
 *   - carries `imported: true` + internal `source` (never shown
 *     publicly — the public page only renders a neutral badge).
 *
 * We DO NOT touch provider.rating here — the rating trigger is the
 * single source of truth and recomputes it on every review write.
 *
 * Dedup: when an item has a `sourceRef`, we skip it if a review with
 * the same (providerId, source, sourceRef) already exists.
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

    const body = await request.json();
    const parsed = importReviewsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { providerId, source, reviews } = parsed.data;
    const db = getAdminFirestore();

    // Validate the provider exists.
    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }

    // Pre-load existing sourceRefs for this (providerId, source) so dedup
    // is a single query rather than one per item.
    const existingRefs = new Set<string>();
    const existingSnap = await db
      .collection('reviews')
      .where('providerId', '==', providerId)
      .where('source', '==', source)
      .get();
    existingSnap.forEach((doc) => {
      const ref = doc.data()?.sourceRef;
      if (typeof ref === 'string' && ref.length > 0) existingRefs.add(ref);
    });

    const now = new Date();
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Batch writes (Firestore allows up to 500 ops per batch).
    let batch = db.batch();
    let opsInBatch = 0;
    const commits: Promise<unknown>[] = [];

    // Track sourceRefs seen WITHIN this payload to also dedup intra-import.
    const seenRefs = new Set<string>();

    for (let i = 0; i < reviews.length; i++) {
      const item = reviews[i];
      const sourceRef = item.sourceRef && item.sourceRef.trim().length > 0 ? item.sourceRef.trim() : null;

      if (sourceRef && (existingRefs.has(sourceRef) || seenRefs.has(sourceRef))) {
        skipped++;
        continue;
      }
      if (sourceRef) seenRefs.add(sourceRef);

      const docRef = db.collection('reviews').doc();
      batch.set(docRef, {
        providerId,
        bookingId: null,
        clientId: null,
        clientEmail: null,
        memberId: null,
        clientName: '',
        clientPhoto: null,
        rating: clampRating(item.rating),
        comment: item.comment && item.comment.length > 0 ? item.comment : null,
        isPublic: true,
        imported: true,
        source,
        serviceLabel: item.serviceLabel && item.serviceLabel.length > 0 ? item.serviceLabel : null,
        sourceRef,
        createdAt: item.createdAt ?? now,
        updatedAt: now,
      });
      created++;
      opsInBatch++;

      if (opsInBatch >= 450) {
        commits.push(batch.commit());
        batch = db.batch();
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) commits.push(batch.commit());
    await Promise.all(commits);

    return NextResponse.json({
      created,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('[admin/reviews/import] Error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
