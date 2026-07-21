import type { MetadataRoute } from 'next';
import { providerRepository, articleRepository } from '@booking-app/firebase';
import { ARTICLE_CATEGORIES, CATEGORIES } from '@booking-app/shared';

const BASE_URL = 'https://opatam.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // fr ↔ en pairing declared on every entry that exists in both languages
  // (Google reads hreflang from the sitemap too, not only from <link> tags).
  const homeLanguages = { fr: BASE_URL, en: `${BASE_URL}/en`, it: `${BASE_URL}/it` };

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: { languages: homeLanguages },
    },
    // English homepage (translated chrome; provider content stays FR).
    {
      url: `${BASE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: { languages: homeLanguages },
    },
    // Italian homepage.
    {
      url: `${BASE_URL}/it`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: { languages: homeLanguages },
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
    // Vertical landing pages — one per trade. Prioritised slightly
    // below the homepage because they are conversion entry points
    // for organic search on trade-specific keywords.
    {
      url: `${BASE_URL}/nail-artist`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Blog category landing pages
    ...ARTICLE_CATEGORIES.map((cat) => ({
      url: `${BASE_URL}/blog/categorie/${cat}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    // Search directory — the crawlable entry point to all providers,
    // plus one indexable landing page per trade category.
    {
      url: `${BASE_URL}/recherche`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
  ];

  // Dynamic provider pages — the most important for SEO.
  // Also emit a category landing page ONLY for categories that actually
  // have at least one published provider (no empty/thin pages in the index).
  let providerPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const providers = await providerRepository.getPublished();
    providerPages = providers
      .filter((p) => p.slug)
      .flatMap((p) => {
        const languages = {
          fr: `${BASE_URL}/p/${p.slug}`,
          en: `${BASE_URL}/en/p/${p.slug}`,
          it: `${BASE_URL}/it/p/${p.slug}`,
        };
        const lastModified = p.updatedAt instanceof Date ? p.updatedAt : new Date();
        return [
          {
            url: languages.fr,
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            alternates: { languages },
          },
          {
            url: languages.en,
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
            alternates: { languages },
          },
          {
            url: languages.it,
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
            alternates: { languages },
          },
        ];
      });

    const populated = new Set(providers.map((p) => p.category).filter(Boolean));
    categoryPages = CATEGORIES.filter((cat) => populated.has(cat.id)).map((cat) => ({
      url: `${BASE_URL}/recherche/${cat.id}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
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

  return [...staticPages, ...categoryPages, ...providerPages, ...articlePages];
}
