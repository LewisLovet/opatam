import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  providerRepository,
  serviceRepository,
  serviceCategoryRepository,
  locationRepository,
  memberRepository,
  availabilityRepository,
} from '@booking-app/firebase';
import {
  demoBookingProvider,
  demoBookingServices,
  demoBookingCategories,
  demoBookingLocations,
  demoBookingMembers,
  demoBookingAvailabilities,
} from '../demoData';
import { EmbedShell, type EmbedTheme } from './EmbedShell';
import { EmbedBookingFlow } from './components/EmbedBookingFlow';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    primary?: string;
    radius?: string;
    theme?: string;
    /** "modal" = popup/floating mode (show mini-header). Default / "inline" = no header. */
    mode?: string;
    /** Pre-select a service by id. */
    service?: string;
  }>;
}

// Prevent indexing — the embed is meant for iframes, not direct traffic
export const metadata: Metadata = {
  robots: { index: false, follow: false },
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
  const showHeader = sp.mode === 'modal';
  const preselectedServiceId = sp.service || null;

  // ── Demo flow — mock data, no Firestore ────────────────────────────────
  if (slug === 'demo') {
    return (
      <EmbedShell primaryColor={primaryColor} radius={radius} theme={theme}>
        <EmbedBookingFlow
          provider={demoBookingProvider}
          services={demoBookingServices.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description ?? null,
            photoURL: null,
            duration: s.duration,
            price: s.price,
            priceMax: null,
            bufferTime: s.bufferTime,
            categoryId: s.categoryId ?? null,
            locationIds: s.locationIds,
            memberIds: s.memberIds,
          }))}
          serviceCategories={demoBookingCategories}
          locations={demoBookingLocations}
          members={demoBookingMembers}
          availabilities={demoBookingAvailabilities}
          preselectedServiceId={preselectedServiceId}
          showHeader={showHeader}
          isDemo
        />
      </EmbedShell>
    );
  }

  // ── Live provider ──────────────────────────────────────────────────────
  const provider = await providerRepository.getBySlug(slug);
  if (!provider || !provider.isPublished) notFound();

  const [services, serviceCategories, locations, members, availabilities] = await Promise.all([
    serviceRepository.getActiveByProvider(provider.id),
    serviceCategoryRepository.getByProvider(provider.id),
    locationRepository.getActiveByProvider(provider.id),
    memberRepository.getActiveByProvider(provider.id),
    availabilityRepository.getByProvider(provider.id),
  ]);

  if (services.length === 0) {
    return (
      <EmbedShell primaryColor={primaryColor} radius={radius} theme={theme} providerId={provider.id}>
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Aucune prestation disponible
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ce prestataire n&apos;a pas encore configuré ses prestations.
          </p>
        </div>
      </EmbedShell>
    );
  }

  // Slim serialization — only what the flow needs
  const serializedProvider = {
    id: provider.id,
    businessName: provider.businessName,
    slug: provider.slug,
    photoURL: provider.photoURL,
    plan: provider.plan,
    settings: {
      maxBookingAdvance: provider.settings.maxBookingAdvance,
      requiresConfirmation: provider.settings.requiresConfirmation,
      bookingNotice: provider.settings.bookingNotice ?? null,
    },
  };

  const serializedServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    photoURL: s.photoURL,
    duration: s.duration,
    price: s.price,
    priceMax: s.priceMax ?? null,
    bufferTime: s.bufferTime,
    categoryId: s.categoryId ?? null,
    locationIds: s.locationIds,
    memberIds: s.memberIds,
  }));

  const serializedCategories = serviceCategories
    .filter((c) => c.isActive)
    .map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }));

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

  return (
    <EmbedShell
      primaryColor={primaryColor}
      radius={radius}
      theme={theme}
      providerId={provider.id}
    >
      <EmbedBookingFlow
        provider={serializedProvider}
        services={serializedServices}
        serviceCategories={serializedCategories}
        locations={serializedLocations}
        members={serializedMembers}
        availabilities={serializedAvailabilities}
        preselectedServiceId={preselectedServiceId}
        showHeader={showHeader}
      />
    </EmbedShell>
  );
}
