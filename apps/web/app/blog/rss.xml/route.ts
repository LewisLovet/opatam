import { articleRepository } from '@booking-app/firebase';

const BASE_URL = 'https://opatam.com';

// Re-generate the feed every hour. RSS readers don't poll faster than that
// in practice, and articles aren't published in real time.
export const revalidate = 3600;

/** Escape XML special chars in user-provided strings. */
function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const articles = await articleRepository.getPublished(50).catch((err) => {
    console.error('[blog/rss] getPublished failed:', err);
    return [];
  });

  const items = articles
    .map((a) => {
      const url = `${BASE_URL}/blog/${a.slug}`;
      const pubDate = (a.publishedAt ?? a.updatedAt).toUTCString();
      const author = xml(a.authorName);
      return `
    <item>
      <title>${xml(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${xml(a.excerpt)}</description>
      <author>noreply@opatam.com (${author})</author>
      <category>${xml(a.category)}</category>
    </item>`;
    })
    .join('');

  const lastBuildDate =
    articles[0]?.publishedAt?.toUTCString() ?? new Date().toUTCString();

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Opatam</title>
    <link>${BASE_URL}/blog</link>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Conseils, témoignages et tutoriels Opatam.</description>
    <language>fr-FR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
}
