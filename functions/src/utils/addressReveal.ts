import * as admin from 'firebase-admin';
import { isAddressRevealed } from '@booking-app/shared';

/**
 * Resolve the address to put in a client email for a booking, honoring
 * address-privacy: for a protected location the EXACT address is only disclosed
 * once isAddressRevealed (confirmed + ≤48h). Otherwise the masked approximate
 * area already snapshotted on the booking is returned (never the street).
 *
 * `pending` is true when the location is protected and the exact address is NOT
 * yet revealed — the email then shows the approx area + a "coming later" notice.
 */
export async function resolveRevealedAddress(booking: {
  locationProtected?: boolean;
  locationAddress?: string;
  status?: string;
  datetime: Date;
  providerId: string;
  locationId: string;
}): Promise<{ address: string; pending: boolean }> {
  const masked = booking.locationAddress || '';
  if (!booking.locationProtected) return { address: masked, pending: false };
  if (!isAddressRevealed({ status: booking.status || '', datetime: booking.datetime })) {
    return { address: masked, pending: true };
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
      return { address: exact, pending: false };
    }
  } catch (e) {
    console.warn('[addressReveal] location fetch failed:', e);
  }
  return { address: masked, pending: false };
}
