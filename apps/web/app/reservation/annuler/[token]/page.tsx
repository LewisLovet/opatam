import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { bookingRepository } from '@booking-app/firebase';
import { CancelClient } from './CancelClient';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.cancel');
  return { title: t('title'), description: t('description') };
}

export default async function CancelPage({ params }: PageProps) {
  const { token } = await params;

  // Fetch booking by cancel token
  const booking = await bookingRepository.getByCancelToken(token);

  // Determine initial state
  let initialState: 'not_found' | 'already_cancelled' | 'past' | 'form' = 'form';
  let cancelledAt: string | null = null;

  if (!booking) {
    initialState = 'not_found';
  } else if (booking.status === 'cancelled') {
    initialState = 'already_cancelled';
    cancelledAt = booking.cancelledAt?.toISOString() || null;
  } else if (booking.datetime < new Date()) {
    initialState = 'past';
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
        locationAddress: booking.locationAddress,
        datetime: booking.datetime.toISOString(),
        endDatetime: booking.endDatetime.toISOString(),
        duration: booking.duration,
        price: booking.price,
        status: booking.status,
        clientInfo: booking.clientInfo,
        deposit: booking.deposit
          ? {
              amount: booking.deposit.amount,
              status: booking.deposit.status,
              refundDeadlineHours: booking.deposit.refundDeadlineHours,
            }
          : null,
      }
    : null;

  return (
    <CancelClient
      booking={serializedBooking}
      token={token}
      initialState={initialState}
      cancelledAt={cancelledAt}
    />
  );
}
