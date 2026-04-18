import { NextRequest, NextResponse } from 'next/server';
import { reviewService, bookingRepository } from '@booking-app/firebase';

interface SubmitReviewRequest {
  bookingId: string;
  rating: number;
  comment?: string;
}

/**
 * POST /api/reviews/submit — submit a review for a booking.
 *
 * Creates (or updates) the review document. The aggregate
 * `provider.rating` is recalculated by the `onReviewRatingUpdate`
 * Cloud Function trigger, which is the single source of truth for
 * rating aggregation (handles create/update/delete uniformly and
 * covers all write paths including the mobile client that writes
 * directly via the Firebase SDK).
 */
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

    // Get booking to find providerId (also validates existence)
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
