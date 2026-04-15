import type { MetadataRoute } from 'next';

const BASE_URL = 'https://opatam.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/p/'],
        disallow: ['/pro/', '/dev/', '/api/', '/admin/', '/login', '/register', '/forgot-password', '/affiliation/', '/reservation/', '/recherche/', '/pricing'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
