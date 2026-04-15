import type { MetadataRoute } from 'next';
import { providerRepository } from '@booking-app/firebase';
import { CATEGORIES } from '@booking-app/shared';

const BASE_URL = 'https://opatam.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/telechargement`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/recrutement`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  // Category pages — /recherche/{category}
  const categoryPages: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE_URL}/recherche/${cat.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Dynamic provider pages
  let providerPages: MetadataRoute.Sitemap = [];
  let cityPages: MetadataRoute.Sitemap = [];
  try {
    const providers = await providerRepository.getPublished();

    providerPages = providers
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${BASE_URL}/p/${p.slug}`,
        lastModified: p.updatedAt instanceof Date ? p.updatedAt : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));

    // City pages — /recherche/{category}/{city} (from unique city+category combos)
    const cityCombos = new Set<string>();
    providers.forEach((p) => {
      if (p.cities?.[0] && p.category) {
        const key = `${p.category}/${p.cities[0].toLowerCase()}`;
        if (!cityCombos.has(key)) {
          cityCombos.add(key);
        }
      }
    });
    cityPages = Array.from(cityCombos).map((combo) => ({
      url: `${BASE_URL}/recherche/${combo}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('[Sitemap] Error fetching providers:', error);
  }

  return [...staticPages, ...categoryPages, ...cityPages, ...providerPages];
}
