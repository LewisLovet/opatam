import * as admin from 'firebase-admin';

// Local mirror of @booking-app/shared's isAddressRevealed (functions avoid
// runtime imports from the shared package — keep in sync).
const ADDRESS_REVEAL_LEAD_HOURS = 48;
function isAddressRevealed(
  booking: { status: string; datetime: Date | string | number },
  now: Date = new Date(),
  leadHours: number = ADDRESS_REVEAL_LEAD_HOURS,
): boolean {
  if (booking.status !== 'confirmed') return false;
  const dt =
    booking.datetime instanceof Date ? booking.datetime : new Date(booking.datetime);
  if (Number.isNaN(dt.getTime())) return false;
  return now.getTime() >= dt.getTime() - leadHours * 60 * 60 * 1000;
}

/**
 * Resolve the address to put in a client email for a booking, honoring
 * address-privacy: for a protected location the EXACT address is only disclosed
 * once isAddressRevealed (confirmed + ≤48h). Otherwise the masked approximate
 * area already snapshotted on the booking is returned (never the street).
 *
 * `pending` is true when the location is protected and the exact address is NOT
 * yet revealed — the email then shows the approx area + a "coming later" notice.
 */
export async function resolveRevealedAddress(
  booking: {
    locationProtected?: boolean;
    locationAddress?: string;
    status?: string;
    datetime: Date;
    providerId: string;
    locationId: string;
  },
  opts?: { forceReveal?: boolean },
): Promise<{ address: string; pending: boolean; accessInstructions: string | null }> {
  const masked = booking.locationAddress || '';
  if (!booking.locationProtected) {
    return { address: masked, pending: false, accessInstructions: null };
  }
  // Reminder emails force the reveal (the address is ALWAYS given with a
  // reminder, whatever its lead time). Confirmation uses the ≤48h rule.
  const reveal =
    opts?.forceReveal === true ||
    isAddressRevealed({ status: booking.status || '', datetime: booking.datetime });
  if (!reveal) {
    return { address: masked, pending: true, accessInstructions: null };
  }
  try {
    const locSnap = await admin
      .firestore()
      .collection('providers')
      .doc(booking.providerId)
      .collection('locations')
      .doc(booking.locationId)
      .get();
    const loc = locSnap.data();
    if (loc) {
      const exact =
        (loc.address && String(loc.address).trim()) ||
        `${loc.postalCode ?? ''} ${loc.city ?? ''}`.trim() ||
        masked;
      const access =
        (loc.accessInstructions && String(loc.accessInstructions).trim()) || null;
      return { address: exact, pending: false, accessInstructions: access };
    }
  } catch (e) {
    console.warn('[addressReveal] location fetch failed:', e);
  }
  return { address: masked, pending: false, accessInstructions: null };
}
