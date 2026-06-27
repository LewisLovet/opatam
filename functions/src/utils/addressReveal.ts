import * as admin from 'firebase-admin';
import { isAddressRevealed } from '@booking-app/shared';

/**
 * Resolve the address to put in a client email for a booking, honoring
 * address-privacy: for a protected location the EXACT address is only disclosed
 * once isAddressRevealed (confirmed + ≤48h). Otherwise the masked approximate
 * area already snapshotted on the booking is returned (never the street).
 */
export async function resolveRevealedAddress(booking: {
  locationProtected?: boolean;
  locationAddress?: string;
  status?: string;
  datetime: Date;
  providerId: string;
  locationId: string;
}): Promise<string> {
  const masked = booking.locationAddress || '';
  if (!booking.locationProtected) return masked;
  if (!isAddressRevealed({ status: booking.status || '', datetime: booking.datetime })) {
    return masked;
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
      return (
        (loc.address && String(loc.address).trim()) ||
        `${loc.postalCode ?? ''} ${loc.city ?? ''}`.trim() ||
        masked
      );
    }
  } catch (e) {
    console.warn('[addressReveal] location fetch failed:', e);
  }
  return masked;
}
