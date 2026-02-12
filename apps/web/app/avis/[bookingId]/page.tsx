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

  // Check if review already exists
  const existingReview = booking ? await reviewRepository.getByBooking(bookingId) : null;

  // Determine initial state
  let initialState: 'not_found' | 'not_yet_passed' | 'already_reviewed' | 'form' = 'form';

  if (!booking) {
    initialState = 'not_found';
  } else if (booking.datetime > new Date()) {
    initialState = 'not_yet_passed';
  } else if (existingReview) {
    initialState = 'already_reviewed';
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
