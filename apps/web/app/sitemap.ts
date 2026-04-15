import type { MetadataRoute } from 'next';
import { providerRepository } from '@booking-app/firebase';

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

  // Dynamic provider pages — the most important for SEO
  let providerPages: MetadataRoute.Sitemap = [];
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
  } catch (error) {
    console.error('[Sitemap] Error fetching providers:', error);
  }

  return [...staticPages, ...providerPages];
}
