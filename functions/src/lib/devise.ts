/**
 * Formatage des montants dans les functions, avec la devise de la
 * reservation.
 *
 * POURQUOI UN MIROIR LOCAL. Les functions ne peuvent PAS importer
 * `@booking-app/shared` a l'execution : le paquet est publie en source ESM et
 * `firebase deploy` echoue. Seuls les `import type` sont permis. Ce fichier
 * reprend donc le comportement de `formatPrice` et `formatPriceCompact`, sans
 * la dependance.
 *
 * LA DEVISE EST CELLE DE LA RESERVATION, jamais celle du prestataire
 * aujourd'hui : un e-mail ou une notification parlent d'un rendez-vous precis,
 * qui garde la devise a laquelle la cliente a consenti. Absente = euro, pour
 * les reservations d'avant la fonctionnalite.
 */

/** Langues de l'application, vers la locale Intl correspondante. */
const LOCALE_INTL: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  it: 'it-IT',
  pt: 'pt-PT',
  de: 'de-DE',
};

function intl(locale: string | null | undefined): string {
  return LOCALE_INTL[(locale ?? 'fr').slice(0, 2)] ?? 'fr-FR';
}

/**
 * Montant dans sa devise, place selon la langue.
 *
 * `Intl` s'occupe du symbole, de sa position, de l'espace insecable et de la
 * virgule decimale : l'anglais ecrit « €35.00 », le francais « 35,00 € ».
 * C'est exactement ce que les libelles ecrits a la main ratent.
 */
export function formatMontant(
  cents: number,
  devise: string | null | undefined = 'EUR',
  locale: string | null | undefined = 'fr',
): string {
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency: devise || 'EUR',
  }).format(cents / 100);
}

/**
 * Forme COMPACTE : « 30 € » plutot que « 30,00 € », et « 29,50 € » quand il y
 * a des centimes. Pour les notifications push, ou chaque caractere compte.
 */
export function formatMontantCompact(
  cents: number,
  devise: string | null | undefined = 'EUR',
  locale: string | null | undefined = 'fr',
): string {
  const montant = cents / 100;
  const rond = montant % 1 === 0;
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency: devise || 'EUR',
    minimumFractionDigits: rond ? 0 : 2,
    maximumFractionDigits: rond ? 0 : 2,
  }).format(montant);
}
