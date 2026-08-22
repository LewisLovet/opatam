import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * PATCH /api/admin/reviews/[reviewId] — toggle review visibility.
 *
 * Only updates the `isPublic` field. The aggregate `provider.rating`
 * and `stats/dashboard` counters are recalculated by the
 * `onReviewRatingUpdate` and `onReviewWrite` Cloud Function triggers.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const adminUid = auth.identity.uid;

    const { reviewId } = await params;
    const body = await request.json();
    const db = getAdminFirestore();

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();
    if (!reviewDoc.exists) {
      return NextResponse.json({ error: 'Avis non trouv\u00e9' }, { status: 404 });
    }

    // Only allow toggling isPublic
    const updateData: Record<string, unknown> = {};
    if (typeof body.isPublic === 'boolean') {
      updateData.isPublic = body.isPublic;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    updateData.updatedAt = new Date();
    await db.collection('reviews').doc(reviewId).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reviews/[reviewId]] PATCH Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/reviews/[reviewId] — delete a review.
 *
 * Only deletes the document. The aggregate `provider.rating` and
 * `stats/dashboard` counters are recalculated by the
 * `onReviewRatingUpdate` and `onReviewWrite` Cloud Function triggers.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const adminUid = auth.identity.uid;

    const { reviewId } = await params;
    const db = getAdminFirestore();

    const reviewDoc = await db.collection('reviews').doc(reviewId).get();
    if (!reviewDoc.exists) {
      return NextResponse.json({ error: 'Avis non trouv\u00e9' }, { status: 404 });
    }

    await db.collection('reviews').doc(reviewId).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reviews/[reviewId]] DELETE Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
