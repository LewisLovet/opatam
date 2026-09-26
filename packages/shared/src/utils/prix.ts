/**
 * Formatage des prix.
 *
 * Extrait de `utils/index.ts` le 2026-09-27 pour une raison précise : cet
 * index importe `zod`, que le lanceur de tests de node ne résout pas. Les deux
 * formateurs au cœur du multidevise étaient donc intestables. Ils sont
 * réexportés depuis l'index, donc aucun appelant ne change.
 *
 * `clientServiceFee` est parti dans `constants/currencies.ts`, avec le barème
 * qu'il lit — c'est sa place, et ce fichier-là n'importe rien non plus.
 */
// AUCUN import, volontairement : les modules de `shared` que le lanceur de
// tests de node sait charger sont ceux qui n'importent rien. `utils/index.ts`
// importe `zod`, qu'il ne résout pas.

/**
 * Format price from cents to display string
 * @param cents - Price in cents
 * @param currency - Currency code (default: EUR)
 * @param locale - BCP 47 locale for number formatting (default: fr-FR —
 *   pass the active UI locale on translated surfaces)
 * @returns Formatted price string
 */
export function formatPrice(
  cents: number,
  // `null` accepte, et pas seulement `undefined` : la devise vient presque
  // toujours de `provider.currency` ou `booking.currency`, qui valent `null`
  // pour un compte d'avant la fonctionnalite. Sans ca, chaque appelant
  // ecrirait `?? undefined` — et il aurait suffi d'en oublier un.
  currency: string | null | undefined = 'EUR',
  locale = 'fr-FR',
): string {
  const devise = currency || 'EUR';
  // "Free" is the only translated word here — a full dictionary lookup would
  // drag react/i18n into shared, so a tiny inline map does the job.
  if (cents === 0) {
    if (locale.startsWith('en')) return 'Free';
    if (locale.startsWith('it')) return 'Gratis';
    if (locale.startsWith('pt')) return 'Grátis';
    if (locale.startsWith('de')) return 'Kostenlos';
    return 'Gratuit';
  }
  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: devise,
  }).format(amount);
}

/**
 * Prix COMPACT : « 120 € » plutôt que « 120,00 € », et « 89,50 € » quand il
 * y a des centimes.
 *
 * Existe pour les pastilles de montant trop étroites pour deux décimales
 * inutiles. Deux copies de cette fonction vivaient dans l'application mobile
 * (l'agenda pro et le composant de journée), toutes deux avec un « € » écrit
 * en dur : un prestataire suisse voyait donc des euros sur son agenda.
 *
 * Contrairement à `formatPrice`, ne renvoie PAS « Gratuit » pour 0 : les
 * appelants traitent 0 comme « pas de montant » et n'affichent rien.
 */
export function formatPriceCompact(
  cents: number,
  currency: string | null | undefined = 'EUR',
  locale = 'fr-FR',
): string {
  const devise = currency || 'EUR';
  const montant = cents / 100;
  const rond = montant % 1 === 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: devise,
    minimumFractionDigits: rond ? 0 : 2,
    maximumFractionDigits: rond ? 0 : 2,
  }).format(montant);
}
