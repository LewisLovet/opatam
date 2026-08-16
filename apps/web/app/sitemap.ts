import type { MetadataRoute } from 'next';
import { providerRepository, articleRepository } from '@booking-app/firebase';
import { ARTICLE_CATEGORIES, CATEGORIES } from '@booking-app/shared';
import { URL_LOCALES } from '@/lib/localizedPath';

const BASE_URL = 'https://opatam.com';

/**
 * Date de dernière retouche des pages dont le contenu est écrit dans le dépôt
 * (accueil éditorial, /recrutement, /telechargement, les pages métier…).
 *
 * À BUMPER quand on modifie réellement une de ces pages.
 *
 * Pourquoi une constante et non `new Date()` : Google se sert de `lastmod`
 * pour décider quand repasser sur une URL qu'il connaît déjà. En appelant
 * `new Date()` à la génération, le sitemap annonçait « modifiée à l'instant »
 * sur toutes ces pages, à chaque lecture — quinze d'entre elles partageaient
 * l'horodatage exact de la génération. Un `lastmod` qui ment sur tout finit
 * par être ignoré, et c'est le seul signal de planification qui reste depuis
 * que Google a supprimé le ping des sitemaps (juin 2023).
 *
 * Oublier de la bumper est sans gravité : Google repassera un peu plus tard
 * sur une page qui, par construction, ne change presque jamais. L'inverse —
 * tout dater à maintenant — coûte la crédibilité de TOUT le fichier.
 */
const EDITORIAL_LAST_MODIFIED = new Date('2026-08-16T00:00:00.000Z');

/** La plus récente d'une série de dates, ou un repli si la série est vide. */
function newestOf(dates: (Date | undefined)[], fallback: Date): Date {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : fallback;
}

/**
 * Table hreflang d'une page : le français à la racine, une entrée par
 * préfixe de langue.
 *
 * Construite depuis URL_LOCALES et non écrite à la main : les blocs répétés
 * par langue avaient laissé l'allemand déclaré comme alternative sans
 * qu'aucune URL /de ne soit listée — Google annonçait la version allemande
 * sans jamais se la voir proposer au crawl.
 */
function languagesFor(path = ''): Record<string, string> {
  const languages: Record<string, string> = { fr: `${BASE_URL}${path}` };
  for (const locale of URL_LOCALES) languages[locale] = `${BASE_URL}/${locale}${path}`;
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Les données sont chargées AVANT de composer les pages fixes : l'accueil,
  // l'annuaire et le blog n'ont pas de contenu propre, ils affichent celui des
  // prestataires et des articles. Leur vraie date de modification est donc la
  // plus récente de ce qu'ils listent — pas l'instant présent.
  let providers: Awaited<ReturnType<typeof providerRepository.getPublished>> = [];
  try {
    providers = await providerRepository.getPublished();
  } catch (error) {
    console.error('[Sitemap] Error fetching providers:', error);
  }
  let articles: Awaited<ReturnType<typeof articleRepository.getPublished>> = [];
  try {
    articles = await articleRepository.getPublished(200);
  } catch (error) {
    console.error('[Sitemap] Error fetching articles:', error);
  }

  const listedProviders = providers.filter((p) => p.slug && !p.isTest);
  const providersLastModified = newestOf(
    listedProviders.map((p) => (p.updatedAt instanceof Date ? p.updatedAt : undefined)),
    EDITORIAL_LAST_MODIFIED,
  );
  const articlesLastModified = newestOf(
    articles.map((a) => (a.updatedAt instanceof Date ? a.updatedAt : undefined)),
    EDITORIAL_LAST_MODIFIED,
  );
  // L'accueil met en avant les prestataires ET renvoie vers le blog.
  const homeLastModified = newestOf(
    [providersLastModified, articlesLastModified],
    EDITORIAL_LAST_MODIFIED,
  );
  // Appariement des langues déclaré sur chaque entrée qui existe dans
  // plusieurs langues (Google lit aussi le hreflang du sitemap, pas
  // seulement les balises <link>).
  const homeLanguages = languagesFor();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: homeLastModified,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: { languages: homeLanguages },
    },
    // Accueils traduits (chrome traduit ; le contenu des pros reste dans sa
    // langue d'auteur). Une entrée par langue, dérivée de la même liste que
    // le hreflang — aucune ne peut être oubliée.
    ...URL_LOCALES.map((locale) => ({
      url: `${BASE_URL}/${locale}`,
      lastModified: homeLastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
      alternates: { languages: homeLanguages },
    })),
    {
      url: `${BASE_URL}/telechargement`,
      lastModified: EDITORIAL_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: EDITORIAL_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/recrutement`,
      lastModified: EDITORIAL_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: articlesLastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Vertical landing pages — one per trade. Prioritised slightly
    // below the homepage because they are conversion entry points
    // for organic search on trade-specific keywords.
    {
      url: `${BASE_URL}/nail-artist`,
      lastModified: EDITORIAL_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/studio-enregistrement`,
      lastModified: EDITORIAL_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Blog category landing pages
    ...ARTICLE_CATEGORIES.map((cat) => ({
      url: `${BASE_URL}/blog/categorie/${cat}`,
      lastModified: articlesLastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    // Search directory — the crawlable entry point to all providers,
    // plus one indexable landing page per trade category.
    {
      url: `${BASE_URL}/recherche`,
      lastModified: providersLastModified,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
  ];

  // Dynamic provider pages — the most important for SEO.
  // Also emit a category landing page ONLY for categories that actually
  // have at least one published provider (no empty/thin pages in the index).
  // `listedProviders` applique déjà le filtre : `isTest` exclut les comptes de
  // démonstration. `getPublished()` ne filtre que `isPublished`, si bien que le
  // salon de démo servant aux captures des stores s'est retrouvé dans le
  // sitemap — un faux commerce, avec une fausse adresse, proposé à
  // l'indexation en cinq langues. Le sitemap ne doit annoncer que des
  // vitrines réelles.
  const providerPages: MetadataRoute.Sitemap = listedProviders
      .flatMap((p) => {
        const languages = languagesFor(`/p/${p.slug}`);
        // Même repli que pour les articles : une fiche sans `updatedAt` n'a
        // pas été modifiée à l'instant où Google lit le sitemap.
        const lastModified =
          p.updatedAt instanceof Date ? p.updatedAt : EDITORIAL_LAST_MODIFIED;
        return [
          {
            url: languages.fr,
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            alternates: { languages },
          },
          // Les versions traduites, listées une par une : sans elles, Google
          // les annonce en hreflang mais ne les rencontre jamais au crawl.
          ...URL_LOCALES.map((locale) => ({
            url: languages[locale],
            lastModified,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
            alternates: { languages },
          })),
        ];
      });

  // Même raison pour les pages catégorie : un métier dont le seul
  // représentant est un compte de démonstration ne doit pas ouvrir une
  // page d'annuaire vide.
  const populated = new Set(listedProviders.map((p) => p.category).filter(Boolean));
  const categoryPages: MetadataRoute.Sitemap = CATEGORIES.filter((cat) =>
    populated.has(cat.id),
  ).map((cat) => ({
    url: `${BASE_URL}/recherche/${cat.id}`,
    lastModified: providersLastModified,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // Blog articles
  const articlePages: MetadataRoute.Sitemap = articles
    .filter((a) => a.slug)
    .map((a) => ({
      url: `${BASE_URL}/blog/${a.slug}`,
      // Repli sur la date éditoriale, jamais sur l'instant présent : un
      // article sans `updatedAt` n'a pas été modifié maintenant.
      lastModified: a.updatedAt instanceof Date ? a.updatedAt : EDITORIAL_LAST_MODIFIED,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

  return [...staticPages, ...categoryPages, ...providerPages, ...articlePages];
}
