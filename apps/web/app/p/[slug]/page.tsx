import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  providerRepository,
  serviceRepository,
  locationRepository,
  memberRepository,
  reviewRepository,
  availabilityRepository,
} from '@booking-app/firebase';
import { ProviderPageClient } from './components/ProviderPageClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const provider = await providerRepository.getBySlug(slug);

  if (!provider || !provider.isPublished) {
    return {
      title: 'Prestataire non trouve',
    };
  }

  const description = provider.description
    ? provider.description.substring(0, 160)
    : `Reservez vos rendez-vous chez ${provider.businessName} - ${provider.category}`;

  return {
    title: `${provider.businessName} | ${provider.category}`,
    description,
    openGraph: {
      title: provider.businessName,
      description,
      images: provider.coverPhotoURL ? [provider.coverPhotoURL] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: provider.businessName,
      description,
      images: provider.coverPhotoURL ? [provider.coverPhotoURL] : [],
    },
  };
}

export default async function ProviderPage({ params }: PageProps) {
  const { slug } = await params;

  // Fetch provider by slug
  const provider = await providerRepository.getBySlug(slug);

  // 404 if provider not found or not published
  if (!provider || !provider.isPublished) {
    notFound();
  }

  // Fetch all related data in parallel
  const [services, locations, members, reviews, availabilities] = await Promise.all([
    serviceRepository.getActiveByProvider(provider.id),
    locationRepository.getActiveByProvider(provider.id),
    memberRepository.getActiveByProvider(provider.id),
    reviewRepository.getRecentByProvider(provider.id, 10),
    availabilityRepository.getByProvider(provider.id),
  ]);

  // Calculate min price from services
  const minPrice = services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  // Serialize dates for client component
  const serializedProvider = {
    ...provider,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
    subscription: {
      ...provider.subscription,
      validUntil: provider.subscription.validUntil.toISOString(),
    },
  };

  const serializedServices = services.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const serializedLocations = locations.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }));

  const serializedMembers = members.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  const serializedReviews = reviews.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  const serializedAvailabilities = availabilities.map((a) => ({
    ...a,
    updatedAt: a.updatedAt.toISOString(),
    effectiveFrom: a.effectiveFrom ? a.effectiveFrom.toISOString() : null,
  }));

  return (
    <ProviderPageClient
      provider={serializedProvider}
      services={serializedServices}
      locations={serializedLocations}
      members={serializedMembers}
      reviews={serializedReviews}
      availabilities={serializedAvailabilities}
      minPrice={minPrice}
    />
  );
}
