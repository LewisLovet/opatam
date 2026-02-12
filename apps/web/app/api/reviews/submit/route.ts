import { NextRequest, NextResponse } from 'next/server';
import { reviewService } from '@booking-app/firebase';

interface SubmitReviewRequest {
  bookingId: string;
  rating: number;
  comment?: string;
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

    // Submit review using the service
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
