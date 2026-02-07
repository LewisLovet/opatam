import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  providerRepository,
  serviceRepository,
  locationRepository,
  memberRepository,
  availabilityRepository,
} from '@booking-app/firebase';
import { BookingFlow } from './components/BookingFlow';
import {
  demoBookingProvider,
  demoBookingServices,
  demoBookingLocations,
  demoBookingMembers,
  demoBookingAvailabilities,
} from '../demoData';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug === 'demo') {
    return {
      title: 'Demo — Réserver chez Studio Beauté Élégance | OPATAM',
      description: 'Testez le parcours de réservation OPATAM avec cette boutique de démonstration.',
    };
  }

  const provider = await providerRepository.getBySlug(slug);

  if (!provider || !provider.isPublished) {
    return {
      title: 'Prestataire non trouvé',
    };
  }

  return {
    title: `Réserver chez ${provider.businessName}`,
    description: `Réservez votre rendez-vous chez ${provider.businessName} - ${provider.category}`,
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
  const [services, locations, members, availabilities] = await Promise.all([
    serviceRepository.getActiveByProvider(provider.id),
    locationRepository.getActiveByProvider(provider.id),
    memberRepository.getActiveByProvider(provider.id),
    availabilityRepository.getByProvider(provider.id),
  ]);

  // No services available
  if (services.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Aucune prestation disponible
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Ce prestataire n'a pas encore configuré ses prestations.
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
    locationIds: s.locationIds,
    memberIds: s.memberIds,
  }));

  const serializedLocations = locations.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    city: l.city,
    postalCode: l.postalCode,
    type: l.type,
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
      locations={serializedLocations}
      members={serializedMembers}
      availabilities={serializedAvailabilities}
      isTeam={isTeam}
      preselectedServiceId={preselectedServiceId}
    />
  );
}
