import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { bookingService } from '@booking-app/firebase';
import { ConfirmationClient } from './ConfirmationClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('seo.confirmation');
  return { title: t('title'), description: t('description') };
}

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
    // Pre-discount total (only set when a promo was applied at booking time).
    originalPrice: booking.originalPrice ?? null,
    items: booking.items?.map((i) => ({
      serviceName: i.serviceName,
      duration: i.duration,
      price: i.price,
      originalPrice: i.originalPrice ?? null,
      selectedVariations: i.selectedVariations ?? [],
      selectedOptions: i.selectedOptions ?? [],
      selectedInfo: i.selectedInfo ?? [],
    })),
    // Top-level choices (mono booking)
    selectedVariations: booking.selectedVariations ?? [],
    selectedOptions: booking.selectedOptions ?? [],
    selectedInfo: booking.selectedInfo ?? [],
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
