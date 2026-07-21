import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  providerRepository,
  serviceRepository,
  serviceCategoryRepository,
  locationRepository,
  memberRepository,
  availabilityRepository,
} from '@booking-app/firebase';
import { BookingFlow } from './components/BookingFlow';
import {
  demoBookingProvider,
  demoBookingServices,
  demoBookingCategories,
  demoBookingLocations,
  demoBookingMembers,
  demoBookingAvailabilities,
} from '../demoData';

// Cache court : reflète l'état réel (publication, prix, dispos) sous 30 s max.
// Voir la note dans ../page.tsx — sans ceci, un 404 (provider dépublié) reste
// figé dans le Full Route Cache après republication.
export const revalidate = 30;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // Serves both /p/[slug]/reserver (fr) and /en/p/[slug]/reserver
  // (re-export, locale set by middleware.ts via the x-app-locale header).
  const locale = await getLocale();
  const t = await getTranslations('seo.booking');
  const tProvider = await getTranslations('seo.provider');

  if (slug === 'demo') {
    const frDemo = 'https://opatam.com/p/demo/reserver';
    const enDemo = 'https://opatam.com/en/p/demo/reserver';
    const itDemo = 'https://opatam.com/it/p/demo/reserver';
    return {
      title: t('demoTitle'),
      description: t('demoDescription'),
      alternates: {
        canonical: locale === 'en' ? enDemo : locale === 'it' ? itDemo : frDemo,
        languages: { fr: frDemo, en: enDemo, it: itDemo, 'x-default': frDemo },
      },
    };
  }

  const provider = await providerRepository.getBySlug(slug);

  if (!provider || !provider.isPublished) {
    return {
      title: tProvider('notFound'),
    };
  }

  const frUrl = `https://opatam.com/p/${slug}/reserver`;
  const enUrl = `https://opatam.com/en/p/${slug}/reserver`;
  const itUrl = `https://opatam.com/it/p/${slug}/reserver`;

  return {
    title: t('title', { businessName: provider.businessName }),
    description: t('description', {
      businessName: provider.businessName,
      category: provider.category,
    }),
    alternates: {
      canonical: locale === 'en' ? enUrl : locale === 'it' ? itUrl : frUrl,
      languages: { fr: frUrl, en: enUrl, it: itUrl, 'x-default': frUrl },
    },
  };
}

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { service: preselectedServiceId } = await searchParams;

  // Demo booking page — serve mock data, no Firestore
  if (slug === 'demo') {
    return (
      <BookingFlow
        provider={demoBookingProvider}
        services={demoBookingServices}
        serviceCategories={demoBookingCategories}
        locations={demoBookingLocations}
        members={demoBookingMembers}
        availabilities={demoBookingAvailabilities}
        isTeam={demoBookingMembers.length > 1}
        preselectedServiceId={preselectedServiceId}
        isDemo
      />
    );
  }

  // Fetch provider by slug
  const provider = await providerRepository.getBySlug(slug);

  if (!provider || !provider.isPublished) {
    notFound();
  }

  // Fetch all related data in parallel
  const [services, serviceCategories, locations, members, availabilities] = await Promise.all([
    serviceRepository.getActiveByProvider(provider.id),
    serviceCategoryRepository.getByProvider(provider.id),
    locationRepository.getActiveByProvider(provider.id),
    memberRepository.getActiveByProvider(provider.id),
    availabilityRepository.getByProvider(provider.id),
  ]);

  // No services available
  if (services.length === 0) {
    const t = await getTranslations('booking.page');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('noServicesTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('noServicesText')}
          </p>
        </div>
      </div>
    );
  }

  // Serialize dates for client component
  const serializedProvider = {
    id: provider.id,
    businessName: provider.businessName,
    slug: provider.slug,
    photoURL: provider.photoURL,
    plan: provider.plan,
    settings: provider.settings,
  };

  const serializedServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    duration: s.duration,
    price: s.price,
    bufferTime: s.bufferTime,
    categoryId: s.categoryId ?? null,
    locationIds: s.locationIds,
    memberIds: s.memberIds,
    // Client-facing choices (empty arrays for plain services).
    variations: s.variations ?? [],
    options: s.options ?? [],
    infoFields: s.infoFields ?? [],
    // Per-service promotion (null = none / inherit the global one).
    discount: s.discount ?? null,
  }));

  const serializedCategories = serviceCategories
    .filter((c) => c.isActive)
    .map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
    }));

  const serializedLocations = locations.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    city: l.city,
    postalCode: l.postalCode,
    countryCode: l.countryCode || 'FR',
    type: l.type,
    protectAddress: l.protectAddress ?? false,
    approxArea: l.approxArea ?? null,
  }));

  const serializedMembers = members.map((m) => ({
    id: m.id,
    name: m.name,
    photoURL: m.photoURL,
    locationId: m.locationId,
    isDefault: m.isDefault,
  }));

  const serializedAvailabilities = availabilities.map((a) => ({
    id: a.id,
    memberId: a.memberId,
    locationId: a.locationId,
    dayOfWeek: a.dayOfWeek,
    slots: a.slots,
    isOpen: a.isOpen,
  }));

  // Check if provider has team plan with multiple members
  const isTeam = provider.plan === 'team' && members.length > 1;

  return (
    <BookingFlow
      provider={serializedProvider}
      services={serializedServices}
      serviceCategories={serializedCategories}
      locations={serializedLocations}
      members={serializedMembers}
      availabilities={serializedAvailabilities}
      isTeam={isTeam}
      preselectedServiceId={preselectedServiceId}
    />
  );
}
