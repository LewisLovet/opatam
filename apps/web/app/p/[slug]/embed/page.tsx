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
import { ProviderPageClient } from '../components/ProviderPageClient';
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
} from '../demoData';
import { EmbedShell, type EmbedTheme } from './EmbedShell';

interface MemberNextAvailability {
  memberId: string;
  memberName: string;
  memberPhoto: string | null;
  nextDate: string | null;
}

/** Copy of the helper in ../page.tsx — kept local to avoid cross-route imports. */
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

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    primary?: string;
    radius?: string;
    theme?: string;
  }>;
}

// Prevent the embed page from appearing in search engines + let it be iframed anywhere
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function parseTheme(raw: string | undefined): EmbedTheme {
  if (raw === 'dark' || raw === 'auto') return raw;
  return 'light';
}

function parseRadius(raw: string | undefined): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 0 && n <= 32) return n;
  return 12;
}

export default async function ProviderEmbedPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const primaryColor = sp.primary || null;
  const radius = parseRadius(sp.radius);
  const theme = parseTheme(sp.theme);

  // Demo page — serve mock data
  if (slug === 'demo') {
    const minPrice = Math.min(...demoServices.map((s) => s.price));
    return (
      <EmbedShell primaryColor={primaryColor} radius={radius} theme={theme}>
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
          isEmbedded
        />
      </EmbedShell>
    );
  }

  // Fetch provider by slug
  const provider = await providerRepository.getBySlug(slug);

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

  const minPrice = services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  const nextAvailableDate = provider.nextAvailableSlot
    ? provider.nextAvailableSlot.toISOString()
    : null;

  const memberAvailabilities: MemberNextAvailability[] = members.map((m: WithId<Member>) => ({
    memberId: m.id,
    memberName: m.name,
    memberPhoto: m.photoURL,
    nextDate: getNextDateForMember(m.id, availabilities),
  }));

  // Serialize dates (same shape as /p/[slug]/page.tsx)
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
    <EmbedShell
      primaryColor={primaryColor}
      radius={radius}
      theme={theme}
      providerId={provider.id}
    >
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
        isEmbedded
      />
    </EmbedShell>
  );
}
