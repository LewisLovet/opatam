import { LOCALES, type AppLocale } from '@booking-app/i18n';

/**
 * Étiquette `og:locale` par langue.
 *
 * Un `Record<AppLocale, …>` et PAS une suite de ternaires : à l'ajout d'une
 * langue, TypeScript refuse de compiler tant que l'entrée manque. Les
 * ternaires binaires écrits à la main sont exactement ce qui a fait passer
 * l'italien pour du français en production.
 */
const OG_LOCALES: Record<AppLocale, string> = {
  fr: 'fr_FR',
  en: 'en_GB',
  it: 'it_IT',
  pt: 'pt_PT',
  de: 'de_DE',
};

export function ogLocale(locale: string): string {
  return OG_LOCALES[locale as AppLocale] ?? OG_LOCALES.fr;
}

/** `https://opatam.com` pour le français (racine), `…/de` pour les autres. */
export function localeUrl(baseUrl: string, locale: string, path = ''): string {
  const prefix = locale === 'fr' || !(LOCALES as readonly string[]).includes(locale) ? '' : `/${locale}`;
  return `${baseUrl}${prefix}${path}`;
}
