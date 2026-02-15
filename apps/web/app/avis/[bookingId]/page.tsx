import type { Metadata } from 'next';
import { bookingRepository, reviewRepository } from '@booking-app/firebase';
import { ReviewClient } from './ReviewClient';

interface PageProps {
  params: Promise<{ bookingId: string }>;
}

export const metadata: Metadata = {
  title: 'Donner votre avis',
  description: 'Partagez votre expérience et aidez les autres clients',
};

export default async function ReviewPage({ params }: PageProps) {
  const { bookingId } = await params;

  // Fetch booking
  const booking = await bookingRepository.getById(bookingId);

  // Check if this client already has a review for this provider (by email)
  let existingReview = null;
  if (booking) {
    const clientEmail = booking.clientInfo.email.toLowerCase().trim();
    existingReview = await reviewRepository.getByEmailForProvider(clientEmail, booking.providerId);

    // Fallback: also check by clientId if booking has one
    if (!existingReview && booking.clientId) {
      existingReview = await reviewRepository.getByClientForProvider(booking.clientId, booking.providerId);
    }
  }

  // Determine initial state
  // 'update_form' = client already left a review for this provider, can update it
  let initialState: 'not_found' | 'not_yet_passed' | 'already_reviewed' | 'form' | 'update_form' = 'form';

  if (!booking) {
    initialState = 'not_found';
  } else if (booking.datetime > new Date()) {
    initialState = 'not_yet_passed';
  } else if (existingReview) {
    initialState = 'update_form';
  }

  // Serialize booking for client component
  const serializedBooking = booking
    ? {
        id: booking.id,
        providerId: booking.providerId,
        providerName: booking.providerName,
        serviceName: booking.serviceName,
        memberName: booking.memberName,
        locationName: booking.locationName,
        datetime: booking.datetime.toISOString(),
        duration: booking.duration,
        clientInfo: {
          name: booking.clientInfo.name,
        },
      }
    : null;

  // Serialize existing review if any
  const serializedReview = existingReview
    ? {
        rating: existingReview.rating,
        comment: existingReview.comment,
        createdAt: existingReview.createdAt.toISOString(),
      }
    : null;

  return (
    <ReviewClient
      booking={serializedBooking}
      bookingId={bookingId}
      initialState={initialState}
      existingReview={serializedReview}
    />
  );
}
