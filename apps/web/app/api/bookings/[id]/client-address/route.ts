import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { isClientAddressRevealed } from '@booking-app/shared';

/**
 * Adresse d'intervention (prestation à domicile) — accès STRICTEMENT
 * authentifié, contrairement à la route adresse-du-lieu : ici c'est
 * l'adresse personnelle d'une cliente, la possession du bookingId ne
 * suffit pas (lien partagé, historique de navigation…).
 *
 *   - Bearer obligatoire, uid === booking.providerId (propriétaire seul).
 *   - Avant confirmation : ville seule (le pro n'a pas encore l'engagement).
 *   - Confirmée/terminée : adresse complète depuis le doc privé Admin-only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length))).uid;
  } catch {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const db = getAdminFirestore();
  const bookingRef = db.collection('bookings').doc(id);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 });
  }
  const booking = bookingSnap.data()!;

  if (booking.providerId !== uid) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!booking.travel) {
    return NextResponse.json({ error: 'Réservation sans déplacement' }, { status: 404 });
  }

  if (!isClientAddressRevealed({ status: booking.status })) {
    return NextResponse.json({
      revealed: false,
      city: booking.travel.clientCity ?? '',
    });
  }

  const privateSnap = await bookingRef.collection('private').doc('clientAddress').get();
  const priv = privateSnap.data();
  if (!priv) {
    // Ne devrait pas arriver (l'adresse est écrite avant la création) —
    // on dégrade en ville plutôt que d'échouer.
    console.error(`[client-address] doc privé absent pour booking ${id}`);
    return NextResponse.json({ revealed: false, city: booking.travel.clientCity ?? '' });
  }

  return NextResponse.json({
    revealed: true,
    address: priv.address,
    postalCode: priv.postalCode,
    city: priv.city,
  });
}
