/**
 * MIROIR de `getProviderText` (@booking-app/shared, utils/service-i18n.ts).
 *
 * Les functions ne peuvent pas importer ce paquet à l'exécution : il est
 * publié en TypeScript source (ESM, imports de répertoires) et Node refuse
 * de le charger au déploiement — même règle que `addressReveal.ts` ou
 * `calculateNextAvailableSlot.ts`. Garder les deux versions identiques.
 *
 * Sert la bio et la consigne de réservation dans la langue demandée quand une
 * traduction existe ; repli champ par champ sur l'original sinon.
 */

interface ProviderTranslationEntry {
  description?: string | null;
  bookingNotice?: string | null;
}

interface ProviderTranslations {
  sourceLocale?: string;
  entries?: Record<string, ProviderTranslationEntry | undefined>;
}

export function getProviderText(
  provider: {
    description?: string | null;
    settings?: { bookingNotice?: string | null } | null;
    bookingNotice?: string | null;
    i18n?: ProviderTranslations | null;
  },
  locale: string,
): { description: string; bookingNotice: string | null } {
  const original = {
    description: provider.description ?? '',
    bookingNotice: provider.settings?.bookingNotice ?? provider.bookingNotice ?? null,
  };
  const i18n = provider.i18n;
  if (!i18n || locale === i18n.sourceLocale) return original;
  const entry = i18n.entries?.[locale];
  if (!entry) return original;
  return {
    description: entry.description || original.description,
    bookingNotice: entry.bookingNotice || original.bookingNotice,
  };
}
