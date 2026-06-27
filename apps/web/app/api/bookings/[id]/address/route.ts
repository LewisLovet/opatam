// Force Paris timezone before any Date operation (Vercel runs in UTC).
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  isAddressRevealed,
  getPublicAreaLabel,
  ADDRESS_REVEAL_LEAD_HOURS,
} from '@booking-app/shared';

/**
 * GET /api/bookings/[id]/address
 *
 * Address-privacy gate. For a protected location the exact street + access
 * instructions are returned ONLY once isAddressRevealed(booking) is true
 * (booking confirmed AND within ~48h of the appointment). Before that, only the
 * approximate area is returned. Resolved server-side (admin SDK) so the exact
 * address never has to live in a client-readable document.
 *
 * Public (keyed by the unguessable booking id), like the cancel-token flow.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getAdminFirestore();

    const bookingSnap = await db.collection('bookings').doc(id).get();
    if (!bookingSnap.exists) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
    }
    const b = bookingSnap.data()!;
    const datetime: Date = b.datetime?.toDate?.() ?? new Date(b.datetime);
    const revealAt = new Date(
      datetime.getTime() - ADDRESS_REVEAL_LEAD_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const revealed = isAddressRevealed({ status: b.status, datetime });

    // Load the location for the exact address (admin read).
    let location: Record<string, any> | null = null;
    if (b.providerId && b.locationId) {
      const locSnap = await db
        .collection('providers')
        .doc(b.providerId)
        .collection('locations')
        .doc(b.locationId)
        .get();
      if (locSnap.exists) location = locSnap.data()!;
    }

    const isProtected = !!(location?.protectAddress ?? b.locationProtected);
    // `location.address` is the full formatted address; use it as-is to avoid
    // doubling the city/postal that it may already contain.
    const exactAddress =
      (location?.address && String(location.address).trim()) ||
      (location ? `${location.postalCode ?? ''} ${location.city ?? ''}`.trim() : '') ||
      b.locationAddress ||
      '';
    const approxArea = location
      ? getPublicAreaLabel(location)
      : b.locationApproxArea || b.locationAddress || '';

    if (!isProtected) {
      return NextResponse.json({
        protected: false,
        revealed: true,
        address: exactAddress,
        accessInstructions: location?.accessInstructions ?? null,
        revealAt: null,
      });
    }

    if (revealed) {
      return NextResponse.json({
        protected: true,
        revealed: true,
        address: exactAddress,
        accessInstructions: location?.accessInstructions ?? null,
        revealAt,
      });
    }

    return NextResponse.json({
      protected: true,
      revealed: false,
      address: approxArea,
      accessInstructions: null,
      revealAt,
    });
  } catch (err) {
    console.error('[bookings/address] error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
