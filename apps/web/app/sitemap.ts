import type { MetadataRoute } from 'next';
import { providerRepository, articleRepository } from '@booking-app/firebase';
import { ARTICLE_CATEGORIES } from '@booking-app/shared';

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
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Blog category landing pages
    ...ARTICLE_CATEGORIES.map((cat) => ({
      url: `${BASE_URL}/blog/categorie/${cat}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
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

  // Blog articles
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const articles = await articleRepository.getPublished(200);
    articlePages = articles
      .filter((a) => a.slug)
      .map((a) => ({
        url: `${BASE_URL}/blog/${a.slug}`,
        lastModified: a.updatedAt instanceof Date ? a.updatedAt : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
  } catch (error) {
    console.error('[Sitemap] Error fetching articles:', error);
  }

  return [...staticPages, ...providerPages, ...articlePages];
}
