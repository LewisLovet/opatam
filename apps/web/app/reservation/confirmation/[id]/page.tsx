import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { bookingService, providerRepository } from '@booking-app/firebase';
import { isLoyaltyConfigValid, hasLoyaltyAccess } from '@booking-app/shared';
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

  // Programme de fidélité du pro — quand il est actif, le bloc « Téléchargez
  // l'app » devient un argument fidélité pour les invités : les points se
  // cumulent déjà par email, l'app sert à les SUIVRE. Best-effort, jamais
  // bloquant pour la page de confirmation.
  let providerLoyalty: { threshold: number; rewardType: 'percent' | 'amount'; rewardValue: number } | null = null;
  try {
    const provider = await providerRepository.getById(booking.providerId);
    const loyalty = provider?.settings?.loyalty ?? null;
    if (isLoyaltyConfigValid(loyalty) && hasLoyaltyAccess(provider)) {
      providerLoyalty = {
        threshold: loyalty.threshold,
        rewardType: loyalty.rewardType,
        rewardValue: loyalty.rewardValue,
      };
    }
  } catch {
    /* page de confirmation toujours servie */
  }

  return <ConfirmationClient booking={serializedBooking} providerLoyalty={providerLoyalty} />;
}
