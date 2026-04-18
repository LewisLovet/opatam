import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

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
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Acc\u00e8s non autoris\u00e9' }, { status: 403 });
    }

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
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Acc\u00e8s non autoris\u00e9' }, { status: 403 });
    }

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
