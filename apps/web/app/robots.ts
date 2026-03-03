import type { MetadataRoute } from 'next';

const BASE_URL = 'https://opatam.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/p/', '/recherche/'],
        disallow: ['/pro/', '/dev/', '/api/', '/login', '/register', '/forgot-password'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
