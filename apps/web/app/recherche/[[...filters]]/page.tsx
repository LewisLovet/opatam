import type { Metadata } from 'next';
import { providerRepository, type WithId } from '@booking-app/firebase';
import { CATEGORIES, capitalizeWords, type Provider } from '@booking-app/shared';
import type { SortOption } from './components';
import { SearchPageClient } from './SearchPageClient';

const BASE_URL = 'https://opatam.com';

async function getProviders(
  category?: string,
  city?: string,
  query?: string,
): Promise<WithId<Provider>[]> {
  try {
    return await providerRepository.searchProviders({ category, city, query });
  } catch (error) {
    console.error('[recherche] provider fetch failed:', error);
    return [];
  }
}

interface PageProps {
  params: Promise<{ filters?: string[] }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}

/** /recherche/beauty/paris → { category: 'beauty', city: 'paris' } */
function parseUrlFilters(filters?: string[]): { category?: string; city?: string } {
  const result: { category?: string; city?: string } = {};
  if (!filters || filters.length === 0) return result;
  if (filters[0] && CATEGORIES.find((c) => c.id === filters[0])) result.category = filters[0];
  if (filters[1]) result.city = decodeURIComponent(filters[1]);
  return result;
}

function categoryLabel(id?: string): string | undefined {
  if (!id) return undefined;
  return CATEGORIES.find((c) => c.id === id)?.label;
}

function buildPath(category?: string, city?: string): string {
  let path = '/recherche';
  if (category) {
    path += `/${category}`;
    if (city) path += `/${encodeURIComponent(city.toLowerCase())}`;
  }
  return path;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { filters } = await params;
  const { q } = await searchParams;
  const { category, city } = parseUrlFilters(filters);
  const label = categoryLabel(category);
  const cityLabel = city ? capitalizeWords(city) : undefined;

  let title = 'Rechercher un prestataire';
  let description =
    'Trouvez et réservez en ligne un prestataire près de chez vous : beauté, bien-être, sport, coaching… Réservation en ligne sur Opatam.';

  if (label && cityLabel) {
    title = `${label} à ${cityLabel}`;
    description = `Réservez un professionnel « ${label} » à ${cityLabel} en ligne. Avis, prix et disponibilités sur Opatam.`;
  } else if (label) {
    title = label;
    description = `Trouvez et réservez un professionnel « ${label} » près de chez vous. Avis, prix et disponibilités sur Opatam.`;
  } else if (cityLabel) {
    title = `Prestataires à ${cityLabel}`;
    description = `Découvrez et réservez les prestataires à ${cityLabel} sur Opatam.`;
  }

  const canonical = `${BASE_URL}${buildPath(category, city)}`;

  // Don't index thin/empty pages: a free-text query, OR a category/city
  // filter that currently returns no provider. Links are still followed,
  // so crawlers reach the providers that DO exist. As the catalogue grows,
  // a once-empty category page becomes indexable automatically.
  const isFiltered = !!category || !!city;
  let indexable = true;
  if (q) {
    indexable = false;
  } else if (isFiltered) {
    const results = await getProviders(category, city, undefined);
    indexable = results.length > 0;
  }

  return {
    title,
    description,
    alternates: { canonical },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: `${title} | Opatam`,
      description,
      url: canonical,
      siteName: 'Opatam',
      type: 'website',
      locale: 'fr_FR',
    },
  };
}

export default async function SearchPage({ params, searchParams }: PageProps) {
  const { filters } = await params;
  const { q, sort } = await searchParams;
  const { category, city } = parseUrlFilters(filters);

  const providers = await getProviders(category, city, q || undefined);

  // Plain-serialise for the client boundary (Dates/Timestamps → strings).
  const initialProviders = JSON.parse(JSON.stringify(providers)) as WithId<Provider>[];

  const validSort: SortOption =
    sort && ['rating', 'price_asc', 'price_desc', 'newest'].includes(sort)
      ? (sort as SortOption)
      : 'rating';

  return (
    <SearchPageClient
      initialProviders={initialProviders}
      initialCategory={category}
      initialCity={city}
      initialQuery={q || ''}
      initialSort={validSort}
    />
  );
}
