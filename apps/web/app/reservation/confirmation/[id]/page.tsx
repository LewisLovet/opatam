import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { bookingService } from '@booking-app/firebase';
import { ConfirmationClient } from './ConfirmationClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Réservation confirmée',
  description: 'Votre réservation a bien été enregistrée',
};

export default async function ConfirmationPage({ params }: PageProps) {
  const { id } = await params;

  const booking = await bookingService.getById(id);

  if (!booking) {
    notFound();
  }

  // Serialize booking for client component
  const serializedBooking = {
    id: booking.id,
    providerName: booking.providerName,
    serviceName: booking.serviceName,
    memberName: booking.memberName,
    locationName: booking.locationName,
    locationAddress: booking.locationAddress,
    datetime: booking.datetime.toISOString(),
    endDatetime: booking.endDatetime.toISOString(),
    duration: booking.duration,
    price: booking.price,
    priceMax: booking.priceMax ?? null,
    items: booking.items?.map((i) => ({
      serviceName: i.serviceName,
      duration: i.duration,
      price: i.price,
    })),
    status: booking.status,
    clientInfo: booking.clientInfo,
    deposit: booking.deposit
      ? {
          amount: booking.deposit.amount,
          status: booking.deposit.status,
        }
      : null,
  };

  return <ConfirmationClient booking={serializedBooking} />;
}
