import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  providerRepository,
  serviceRepository,
  serviceCategoryRepository,
  locationRepository,
  memberRepository,
  reviewRepository,
  availabilityRepository,
} from '@booking-app/firebase';
import type { WithId } from '@booking-app/firebase';
import type { Availability, Member } from '@booking-app/shared';
import { ProviderPageClient } from './components/ProviderPageClient';
import {
  demoProvider,
  demoServices,
  demoServiceCategories,
  demoLocations,
  demoMembers,
  demoReviews,
  demoAvailabilities,
  getDemoNextAvailableDate,
  getDemoMemberAvailabilities,
} from './demoData';

interface MemberNextAvailability {
  memberId: string;
  memberName: string;
  memberPhoto: string | null;
  nextDate: string | null;
}

/**
 * Calculate the next available date for a single member based on their availabilities
 */
function getNextDateForMember(
  memberId: string,
  availabilities: WithId<Availability>[]
): string | null {
  const memberAvailabilities = availabilities.filter(
    (a) => a.memberId === memberId && a.isOpen && a.slots.length > 0
  );

  if (memberAvailabilities.length === 0) return null;

  const openDays = new Set<number>();
  memberAvailabilities.forEach((a) => openDays.add(a.dayOfWeek));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    if (openDays.has(checkDate.getDay())) {
      return checkDate.toISOString();
    }
  }

  return null;
}

/**
 * Calculate the next available date based on availabilities
 * Returns the earliest date across all members, plus per-member availability for Team plans
 */
function calculateAvailabilities(
  availabilities: WithId<Availability>[],
  members: WithId<Member>[]
): { nextAvailableDate: string | null; memberAvailabilities: MemberNextAvailability[] } {
  if (members.length === 0) {
    return { nextAvailableDate: null, memberAvailabilities: [] };
  }

  // Calculate per-member availability
  const memberAvailabilities: MemberNextAvailability[] = members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    memberPhoto: m.photoURL,
    nextDate: getNextDateForMember(m.id, availabilities),
  }));

  // Global next available = earliest across all members
  const allDates = memberAvailabilities
    .map((ma) => ma.nextDate)
    .filter((d): d is string => d !== null);

  const nextAvailableDate = allDates.length > 0
    ? allDates.sort()[0]
    : null;

  return { nextAvailableDate, memberAvailabilities };
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Demo page metadata
  if (slug === 'demo') {
    return {
      title: 'Demo — Studio Beauté Élégance | OPATAM',
      description:
        'Découvrez à quoi ressemble une page de réservation OPATAM. Exemple avec un salon de coiffure et esthétique.',
    };
  }

  const provider = await providerRepository.getBySlug(slug);

  if (!provider || !provider.isPublished) {
    return {
      title: 'Prestataire non trouvé',
    };
  }

  const city = provider.cities?.[0] || '';
  const description = provider.description
    ? provider.description.substring(0, 160)
    : `Réservez vos rendez-vous chez ${provider.businessName}${city ? ` à ${city}` : ''} — ${provider.category}. Prise de RDV en ligne sur Opatam.`;

  const pageUrl = `https://opatam.com/p/${slug}`;

  return {
    title: `${provider.businessName}${city ? ` — ${city}` : ''} | ${provider.category} | Opatam`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${provider.businessName}${city ? ` — ${city}` : ''}`,
      description,
      url: pageUrl,
      siteName: 'Opatam',
      images: provider.coverPhotoURL ? [provider.coverPhotoURL] : [],
      type: 'website',
      locale: 'fr_FR',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${provider.businessName}${city ? ` — ${city}` : ''}`,
      description,
      images: provider.coverPhotoURL ? [provider.coverPhotoURL] : [],
    },
  };
}

export default async function ProviderPage({ params }: PageProps) {
  const { slug } = await params;

  // Demo page — serve mock data without any Firestore call
  if (slug === 'demo') {
    const minPrice = Math.min(...demoServices.map((s) => s.price));
    return (
      <ProviderPageClient
        provider={demoProvider}
        services={demoServices}
        serviceCategories={demoServiceCategories}
        locations={demoLocations}
        members={demoMembers}
        reviews={demoReviews}
        availabilities={demoAvailabilities}
        minPrice={minPrice}
        nextAvailableDate={getDemoNextAvailableDate()}
        memberAvailabilities={getDemoMemberAvailabilities()}
        isDemo
      />
    );
  }

  // Fetch provider by slug
  const provider = await providerRepository.getBySlug(slug);

  // 404 if provider not found or not published
  if (!provider || !provider.isPublished) {
    notFound();
  }

  // Fetch all related data in parallel
  const [services, serviceCategories, locations, members, reviews, availabilities] = await Promise.all([
    serviceRepository.getActiveByProvider(provider.id),
    serviceCategoryRepository.getByProvider(provider.id),
    locationRepository.getActiveByProvider(provider.id),
    memberRepository.getActiveByProvider(provider.id),
    reviewRepository.getRecentByProvider(provider.id, 10),
    availabilityRepository.getByProvider(provider.id),
  ]);

  // Calculate min price from services
  const minPrice = services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  // Calculate next available date based on availabilities (per-member for Team plans)
  const { nextAvailableDate, memberAvailabilities } = calculateAvailabilities(availabilities, members);

  // Serialize dates for client component
  const serializedProvider = {
    ...provider,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
    subscription: provider.subscription
      ? {
          ...provider.subscription,
          validUntil: provider.subscription.validUntil.toISOString(),
          currentPeriodEnd: provider.subscription.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
  };

  const serializedServices = services.map((s) => ({
    ...s,
    categoryId: s.categoryId ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const serializedServiceCategories = serviceCategories
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
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
      serviceCategories={serializedServiceCategories}
      locations={serializedLocations}
      members={serializedMembers}
      reviews={serializedReviews}
      availabilities={serializedAvailabilities}
      minPrice={minPrice}
      nextAvailableDate={nextAvailableDate}
      memberAvailabilities={memberAvailabilities}
    />
  );
}
