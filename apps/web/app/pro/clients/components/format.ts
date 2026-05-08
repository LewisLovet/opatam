/**
 * Local formatting helpers for the clients page.
 *
 * `formatRevenue` mirrors `formatPrice` from @booking-app/shared but
 * never returns "Gratuit" — for cumulative revenue (CA cumulé) the
 * literal `0 €` is more meaningful than "Gratuit", which only makes
 * sense for individual zero-priced services.
 */

/** "0 €" / "1 234 €" — never "Gratuit". */
export function formatRevenue(cents: number, currency = 'EUR'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    // Hide cents on round amounts so "0 €" doesn't render "0,00 €".
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
