import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { MESSAGES } from '@booking-app/i18n';
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

// Cache court : reflète l'état réel (publication, prix, dispos) sous 30 s max.
// Voir la note dans ../page.tsx — sans ceci, un 404 (provider dépublié) reste
// figé dans le Full Route Cache après republication.
export const revalidate = 30;

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
    /** Widget language ('en' — anything else = French). Explicit param
     *  because the embed lives in a cross-site iframe where our locale
     *  cookie is unreliable; the embedding pro decides. */
    lang?: string;
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
  // Explicit widget language: ?lang=en → English, anything else → French.
  // ALWAYS wrapped in a scoped provider — without it the embed would fall
  // through to the root layout provider and inherit the visitor's
  // NEXT_LOCALE cookie, showing English on a widget whose integrator chose
  // the default (French).
  const embedLocale = sp.lang === 'en' ? ('en' as const) : ('fr' as const);
  const withLocale = (children: ReactNode) => (
    <NextIntlClientProvider locale={embedLocale} messages={MESSAGES[embedLocale] as never}>
      {children}
    </NextIntlClientProvider>
  );

  // ── Demo flow — mock data, no Firestore ────────────────────────────────
  if (slug === 'demo') {
    return withLocale(
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
    const t = await getTranslations({ locale: embedLocale, namespace: 'booking.page' });
    return withLocale(
      <EmbedShell primaryColor={primaryColor} radius={radius} theme={theme} providerId={provider.id}>
        <div className="min-h-[200px] flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {t('noServicesTitle')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('noServicesText')}
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

  return withLocale(
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
