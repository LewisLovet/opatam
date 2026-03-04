import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

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
    const updateData: Record<string, any> = {};
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

    const reviewData = reviewDoc.data()!;
    const rating = reviewData.rating || 0;
    const providerId = reviewData.providerId;

    // Delete the review document
    await db.collection('reviews').doc(reviewId).delete();

    // Update stats/dashboard: totalReviews -1, ratingSum - rating
    await db.collection('stats').doc('dashboard').update({
      totalReviews: FieldValue.increment(-1),
      ratingSum: FieldValue.increment(-rating),
    });

    // Recalculate provider rating from remaining reviews
    if (providerId) {
      const remainingReviewsSnap = await db
        .collection('reviews')
        .where('providerId', '==', providerId)
        .select('rating')
        .get();

      const count = remainingReviewsSnap.size;
      let newAverage = 0;

      if (count > 0) {
        let sum = 0;
        remainingReviewsSnap.docs.forEach((doc) => {
          sum += doc.data().rating || 0;
        });
        newAverage = sum / count;
      }

      await db.collection('providers').doc(providerId).update({
        rating: newAverage,
        reviewCount: count,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reviews/[reviewId]] DELETE Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
