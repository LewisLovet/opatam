/**
 * Address-privacy helpers (shared web + mobile + functions).
 *
 * For "protected" locations (à domicile) the exact address is only disclosed
 * to a client close to the appointment. This module is the SINGLE source of
 * truth for "is the address revealed yet?" — used by the emails, the gated
 * reveal endpoint and the app UI so they can never disagree.
 */

/** How many hours before the appointment a protected address is revealed. */
export const ADDRESS_REVEAL_LEAD_HOURS = 48;

/**
 * Whether the exact address of a protected location should be revealed to the
 * client for a given booking.
 *
 * True only when BOTH:
 *  - the booking is `confirmed` — and for deposit bookings, "confirmed" already
 *    means the deposit was paid, so this enforces "no address without commitment";
 *  - we are within `leadHours` of the appointment (default 48h). If the booking
 *    was made inside that window, this is already true at confirmation time, so
 *    the address goes straight into the confirmation email.
 */
export function isAddressRevealed(
  booking: { status: string; datetime: Date | string | number },
  now: Date = new Date(),
  leadHours: number = ADDRESS_REVEAL_LEAD_HOURS,
): boolean {
  if (booking.status !== 'confirmed') return false;
  const dt =
    booking.datetime instanceof Date ? booking.datetime : new Date(booking.datetime);
  if (Number.isNaN(dt.getTime())) return false;
  const revealFromMs = dt.getTime() - leadHours * 60 * 60 * 1000;
  return now.getTime() >= revealFromMs;
}

/**
 * Public, non-revealing label for a location — what a client may see BEFORE the
 * exact address is disclosed. Uses the explicit approximate area, falling back
 * to the city (then postal code). Never includes the street.
 */
export function getPublicAreaLabel(loc: {
  approxArea?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): string {
  const area = loc.approxArea?.trim();
  if (area) return area;
  if (loc.city?.trim()) return loc.city.trim();
  return loc.postalCode?.trim() || '';
}
