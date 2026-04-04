import { NextRequest, NextResponse } from 'next/server';
import { reviewService, reviewRepository, bookingRepository } from '@booking-app/firebase';
import { getAdminFirestore } from '@/lib/firebase-admin';

interface SubmitReviewRequest {
  bookingId: string;
  rating: number;
  comment?: string;
}

/**
 * Recalculate provider rating using firebase-admin (bypasses security rules).
 * Called after review creation/update since the client SDK can't update the provider doc.
 */
async function recalculateProviderRatingAdmin(providerId: string): Promise<void> {
  const adminDb = getAdminFirestore();

  // Get all reviews for this provider
  const reviewsSnapshot = await adminDb
    .collection('reviews')
    .where('providerId', '==', providerId)
    .where('isPublic', '==', true)
    .get();

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;

  reviewsSnapshot.forEach((doc) => {
    const rating = doc.data().rating as number;
    if (rating >= 1 && rating <= 5) {
      distribution[rating]++;
      total += rating;
    }
  });

  const count = reviewsSnapshot.size;
  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  // Update provider with firebase-admin (bypasses rules)
  await adminDb.collection('providers').doc(providerId).update({
    rating: { average, count, distribution },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmitReviewRequest = await request.json();
    const { bookingId, rating, comment } = body;

    // Validate required fields
    if (!bookingId) {
      return NextResponse.json(
        { error: 'L\'identifiant de la réservation est requis' },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'La note doit être comprise entre 1 et 5' },
        { status: 400 }
      );
    }

    // Get booking to find providerId
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { error: 'Réservation non trouvée' },
        { status: 400 }
      );
    }

    // Submit review using the service (creates or updates the review doc)
    const review = await reviewService.submitReviewByBooking(
      bookingId,
      rating,
      comment
    );

    // Recalculate provider rating server-side (bypasses Firestore rules)
    try {
      await recalculateProviderRatingAdmin(booking.providerId);
    } catch (ratingErr) {
      // Non-blocking — the review is saved, rating update can be retried
      console.error('[REVIEW-SUBMIT] Rating recalculation failed:', ratingErr);
    }

    return NextResponse.json({ success: true, reviewId: review.id });
  } catch (error) {
    console.error('[REVIEW-SUBMIT] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
