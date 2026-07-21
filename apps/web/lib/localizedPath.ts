import type { AppLocale } from '@booking-app/i18n';

/**
 * Public/client surfaces that exist in English. Two consumers:
 *  - localizedPath(): only these paths get the /en prefix — a link to an
 *    untranslated page (/register, /recherche…) stays unprefixed even from
 *    an English page.
 *  - <LanguageSuggestionBanner>: only shows the "available in English" card
 *    on these surfaces.
 *
 * ALLOWLIST on purpose: a new page is excluded until its i18n phase lands
 * and it gets added here.
 */
export const TRANSLATED_PREFIXES = ['/p/', '/reservation/', '/avis/'];

export function isTranslatedSurface(pathname: string): boolean {
  const clean = stripEnPrefix(pathname);
  if (clean === '/') return true;
  return TRANSLATED_PREFIXES.some((p) => clean.startsWith(p));
}

/** Préfixes de locale gérés en URL (le français vit à la racine). */
const URL_LOCALES = ['en', 'it'] as const;

/** '/en/p/x' → '/p/x' ; '/it' → '/' ; anything else unchanged. */
export function stripEnPrefix(pathname: string): string {
  for (const l of URL_LOCALES) {
    if (pathname === `/${l}`) return '/';
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

/**
 * The same page in the requested locale:
 *   localizedPath('/p/x', 'en')      → '/en/p/x'
 *   localizedPath('/en/p/x', 'fr')   → '/p/x'
 *   localizedPath('/#tarifs', 'en')  → '/en#tarifs'
 *   localizedPath('/register', 'en') → '/register'  (not translated → no prefix)
 * Query strings and hash fragments are preserved.
 */
export function localizedPath(pathname: string, locale: AppLocale | string): string {
  // Split off ?query / #hash so the prefix logic only sees the path.
  const suffixStart = pathname.search(/[?#]/);
  const path = suffixStart === -1 ? pathname : pathname.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? '' : pathname.slice(suffixStart);

  const clean = stripEnPrefix(path);
  if (!(URL_LOCALES as readonly string[]).includes(locale)) return clean + suffix;
  if (!isTranslatedSurface(clean)) return clean + suffix;
  return (clean === '/' ? `/${locale}` : `/${locale}${clean}`) + suffix;
}
