import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
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
import { getServiceMinPrice } from '@booking-app/shared';
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

// Cache court : la page publique doit refléter l'état réel (publication /
// dépublication, prix, dispos) sous 30 s au maximum. Sans directive, Next rend
// cette route statiquement et la met — y compris un `notFound()` 404 — dans le
// Full Route Cache *indéfiniment*. Un provider republié pouvait alors rester
// « Prestataire introuvable » tant que le cache n'était pas invalidé.
export const revalidate = 30;

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
  // Serves both /p/[slug] (fr) and /en/p/[slug] (re-export, locale set by
  // middleware.ts via the x-app-locale header).
  const locale = await getLocale();
  const t = await getTranslations('seo.provider');

  // Demo page metadata
  if (slug === 'demo') {
    const frDemo = 'https://opatam.com/p/demo';
    const enDemo = 'https://opatam.com/en/p/demo';
    const itDemo = 'https://opatam.com/it/p/demo';
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
      title: t('notFound'),
    };
  }

  const city = provider.cities?.[0] || '';
  // The pro's own description (their content, kept verbatim in any locale);
  // the generated fallback sentence follows the page language.
  const description = provider.description
    ? provider.description.substring(0, 160)
    : t('fallbackDescription', {
        businessName: provider.businessName,
        cityPart: city ? t('inCity', { city }) : '',
        category: provider.category,
      });

  const frUrl = `https://opatam.com/p/${slug}`;
  const enUrl = `https://opatam.com/en/p/${slug}`;
  const itUrl = `https://opatam.com/it/p/${slug}`;
  const pageUrl = locale === 'en' ? enUrl : locale === 'it' ? itUrl : frUrl;
  const languages = { fr: frUrl, en: enUrl, it: itUrl, 'x-default': frUrl };

  // Social/preview image = the PROVIDER's own identity: cover photo
  // first, then their logo. We deliberately do NOT fall back to the
  // Opatam default — a provider's share card should show THEM, not the
  // platform. (The small favicon in Google results is domain-level and
  // stays Opatam — that's expected and fine.)
  const ogImage = provider.coverPhotoURL || provider.photoURL;
  const ogImages = ogImage ? [ogImage] : [];

  return {
    // Note: the root layout title template already appends " | OPATAM",
    // so we must NOT add it here (avoids the duplicated suffix).
    title: `${provider.businessName}${city ? ` — ${city}` : ''} · ${provider.category}`,
    description,
    alternates: {
      canonical: pageUrl,
      languages,
    },
    openGraph: {
      title: `${provider.businessName}${city ? ` — ${city}` : ''}`,
      description,
      url: pageUrl,
      siteName: 'Opatam',
      images: ogImages,
      type: 'website',
      locale: locale === 'en' ? 'en_GB' : locale === 'it' ? 'it_IT' : 'fr_FR',
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: `${provider.businessName}${city ? ` — ${city}` : ''}`,
      description,
      images: ogImages,
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

  // Calculate min price from services (variation-aware: cheapest reachable
  // price; falls back to base price for services without variations).
  const minPrice =
    services.length > 0
      ? Math.min(...services.map((s) => getServiceMinPrice(s)))
      : null;

  // Use cached nextAvailableSlot from provider (updated by Cloud Functions on booking changes + every 2h)
  const nextAvailableDate = provider.nextAvailableSlot
    ? provider.nextAvailableSlot.toISOString()
    : null;

  // Per-member availability for Team plans (lightweight: just checks open days, not bookings)
  const memberAvailabilities: MemberNextAvailability[] = members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    memberPhoto: m.photoURL,
    nextDate: getNextDateForMember(m.id, availabilities),
  }));

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

  // JSON-LD structured data for SEO (LocalBusiness + AggregateRating)
  const city = provider.cities?.[0] || '';
  const location = locations[0];
  const primaryCity = provider.cities?.[0] || '';
  const categoryLabel = provider.category.charAt(0).toUpperCase() + provider.category.slice(1);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LocalBusiness',
        '@id': `https://opatam.com/p/${provider.slug}#business`,
        name: provider.businessName,
        description: provider.description || `${provider.businessName} — ${categoryLabel}${primaryCity ? ` à ${primaryCity}` : ''}`,
        url: `https://opatam.com/p/${provider.slug}`,
        image: provider.coverPhotoURL || provider.photoURL || undefined,
        ...(location && {
          address: {
            '@type': 'PostalAddress',
            // Never expose the street of a protected location in SEO markup.
            ...(location.address && !location.protectAddress && { streetAddress: location.address }),
            addressLocality: location.city,
            postalCode: location.postalCode,
            addressCountry: location.countryCode || 'FR',
          },
          ...(location.geopoint && {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: location.geopoint.latitude,
              longitude: location.geopoint.longitude,
            },
          }),
        }),
        ...(provider.rating?.average && provider.rating.average > 0 && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: provider.rating.average.toFixed(1),
            reviewCount: provider.rating.count || reviews.length,
            bestRating: '5',
          },
        }),
        ...(minPrice !== null && {
          priceRange: minPrice === 0 ? 'Gratuit' : `À partir de ${(minPrice / 100).toFixed(0)} €`,
        }),
        ...(services.length > 0 && {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: 'Prestations',
            itemListElement: services.slice(0, 10).map((s) => ({
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: s.name,
                ...(s.description && { description: s.description }),
              },
              price: (getServiceMinPrice(s) / 100).toFixed(2),
              priceCurrency: 'EUR',
            })),
          },
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Accueil',
            item: 'https://opatam.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: categoryLabel,
            item: `https://opatam.com/recherche/${provider.category}`,
          },
          ...(primaryCity ? [{
            '@type': 'ListItem',
            position: 3,
            name: primaryCity,
            item: `https://opatam.com/recherche/${provider.category}/${primaryCity.toLowerCase()}`,
          }] : []),
          {
            '@type': 'ListItem',
            position: primaryCity ? 4 : 3,
            name: provider.businessName,
            item: `https://opatam.com/p/${provider.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
    </>
  );
}
