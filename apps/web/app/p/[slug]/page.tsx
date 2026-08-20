import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ogLocale, localeUrl } from '@/lib/ogLocale';
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
import { ProviderThemeStyle } from '@/components/theme/ProviderThemeStyle';
import { PageRevealGate } from '@/components/loading/PageRevealGate';
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
    // `localeUrl` construit l'URL depuis la locale : ajouter une langue ne
    // demande plus d'allonger une chaîne de ternaires — le seul endroit à
    // tenir à jour est la liste LOCALES.
    const demo = (l: string) => localeUrl('https://opatam.com', l, '/p/demo');
    return {
      title: t('demoTitle'),
      description: t('demoDescription'),
      alternates: {
        canonical: demo(locale),
        languages: {
          fr: demo('fr'),
          en: demo('en'),
          it: demo('it'),
          pt: demo('pt'),
          de: demo('de'),
          'x-default': demo('fr'),
        },
      },
    };
  }

  const provider = await providerRepository.getBySlug(slug);

  if (!provider || !provider.isPublished) {
    return {
      title: t('notFound'),
    };
  }

  // ── Le titre est le champ le plus disputé d'une page ────────────────────
  //
  // Il portait `provider.category` brut : « Braidztouch — lyon · beauty ».
  // « beauty » est un identifiant de base de données, pas un mot que
  // quelqu'un tape dans un moteur — et il s'affichait en anglais sur une
  // page française. La ville, elle, arrive telle que le professionnel l'a
  // saisie, souvent en minuscules.
  const tCat = await getTranslations('businessCategories');
  const rawCity = provider.cities?.[0] || '';
  // « saint-étienne » → « Saint-Étienne » : chaque partie est capitalisée,
  // traits d'union et apostrophes compris (Aix-en-Provence, L'Haÿ-les-Roses).
  const city = rawCity.replace(
    /(^|[\s\-'’])(\p{L})/gu,
    (_, sep, ch) => sep + ch.toLocaleUpperCase('fr-FR'),
  );
  // Un identifiant absent du dictionnaire ne doit pas faire échouer la page :
  // mieux vaut un titre sans mention de métier qu'une erreur de rendu.
  let categoryLabel = '';
  try {
    categoryLabel = tCat(provider.category);
  } catch {
    categoryLabel = '';
  }

  // The pro's own description (their content, kept verbatim in any locale);
  // the generated fallback sentence follows the page language.
  const description = provider.description
    ? provider.description.substring(0, 160)
    : t('fallbackDescription', {
        businessName: provider.businessName,
        cityPart: city ? t('inCity', { city }) : '',
        category: categoryLabel || provider.category,
      });

  const url = (l: string) => localeUrl('https://opatam.com', l, `/p/${slug}`);
  const pageUrl = url(locale);
  const languages = {
    fr: url('fr'),
    en: url('en'),
    it: url('it'),
    pt: url('pt'),
    de: url('de'),
    'x-default': url('fr'),
  };

  // Social/preview image = the PROVIDER's own identity: cover photo
  // first, then their logo. We deliberately do NOT fall back to the
  // Opatam default — a provider's share card should show THEM, not the
  // platform. (The small favicon in Google results is domain-level and
  // stays Opatam — that's expected and fine.)
  /*
   * Plus d'image déclarée ici : `opengraph-image.tsx` la GÉNÈRE pour cette
   * route, et Next pose la balise tout seul.
   *
   * On y renvoyait la couverture du salon — joignable et valide, mais de
   * rapport et de poids quelconques : celle de « Salon de Coiffure » fait
   * 1200 × 400 pour 678 Ko, loin du 1,91:1 attendu. Messages la refusait et
   * retombait sur le favicon, un PNG transparent, sur un fond que
   * l'application inventait. Le professionnel partageait sa page et voyait
   * apparaître le logo Opatam sur une couleur que personne n'avait décidée.
   *
   * Déclarer les deux ferait cohabiter deux balises `og:image` et laisserait
   * le client choisir — c'est précisément ce qu'on cherche à lui retirer.
   */

  return {
    // Note: the root layout title template already appends " | OPATAM",
    // so we must NOT add it here (avoids the duplicated suffix).
    title: `${provider.businessName}${city ? ` — ${city}` : ''}${categoryLabel ? ` · ${categoryLabel}` : ''}`,
    description,
    alternates: {
      canonical: pageUrl,
      languages,
    },
    // Bandeau App Store : incitation au téléchargement, jamais une
    // ouverture automatique — l'app ne route plus aucune URL du site.
    // Pas d'`app-argument` : plus personne ne le lit.
    other: { 'apple-itunes-app': 'app-id=6759246218' },
    openGraph: {
      title: `${provider.businessName}${city ? ` — ${city}` : ''}`,
      description,
      url: pageUrl,
      siteName: 'Opatam',
      type: 'website',
      locale: ogLocale(locale),
    },
    twitter: {
      // L'image générée fait toujours 1200 × 630 : la grande carte est
      // désormais garantie, plus conditionnelle.
      card: 'summary_large_image',
      title: `${provider.businessName}${city ? ` — ${city}` : ''}`,
      description,
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
  // Les prestations suspendues sont écartées : le « à partir de » de l'en-tête
  // et le balisage JSON-LD annonceraient un prix non réservable.
  const bookableServices = services.filter((s) => s.isAvailable !== false);
  const minPrice =
    bookableServices.length > 0
      ? Math.min(...bookableServices.map((s) => getServiceMinPrice(s)))
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
  // Même correction que pour le titre : capitaliser l'identifiant donnait
  // « Beauty » dans des données structurées lues par les moteurs. Le
  // dictionnaire porte le libellé métier, dans la langue de la page.
  const tCatLd = await getTranslations('businessCategories');
  const tCommun = await getTranslations('common');
  let categoryLabel: string;
  try {
    categoryLabel = tCatLd(provider.category);
  } catch {
    categoryLabel = provider.category.charAt(0).toUpperCase() + provider.category.slice(1);
  }

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
      {/* Les deux images du haut de page, annoncées AVANT d'être rencontrées.
          Sans ça le navigateur ne les découvre qu'une fois le HTML analysé,
          et la page s'affiche pendant qu'elles descendent encore : cadre gris
          à la place de la couverture, pastille vide à la place du logo. Elles
          sont connues côté serveur, autant le dire tout de suite. */}
      {provider.coverPhotoURL && (
        <link rel="preload" as="image" href={provider.coverPhotoURL} fetchPriority="high" />
      )}
      {provider.photoURL && (
        <link rel="preload" as="image" href={provider.photoURL} fetchPriority="high" />
      )}
      {/* Rideau le temps que la couverture et le logo arrivent. Plafonné à
          1,5 s, et le plafond est écrit en CSS pour ne dépendre de rien. */}
      <PageRevealGate
        images={[provider.coverPhotoURL, provider.photoURL]}
        label={tCommun('loading')}
      />
      {/* Thème du prestataire : la balise <style> pose les jetons, l'attribut
          délimite leur portée. Rendu côté serveur, sinon la page s'afficherait
          brièvement en bleu avant de virer à la bonne couleur. */}
      <ProviderThemeStyle themeId={provider.themeId} />
      <div data-provider-theme>
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
      </div>
    </>
  );
}
