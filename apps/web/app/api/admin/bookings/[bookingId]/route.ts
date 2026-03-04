import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled', 'noshow'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Acc\u00e8s non autoris\u00e9' }, { status: 403 });
    }

    const { bookingId } = await params;
    const db = getAdminFirestore();

    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: 'R\u00e9servation non trouv\u00e9e' }, { status: 404 });
    }

    const bookingData = bookingDoc.data()!;

    // Fetch provider and client info in parallel
    const [providerSnap, clientSnap] = await Promise.all([
      bookingData.providerId
        ? db.collection('providers').doc(bookingData.providerId).get()
        : Promise.resolve(null),
      bookingData.clientId
        ? db.collection('users').doc(bookingData.clientId).get()
        : Promise.resolve(null),
    ]);

    const provider = providerSnap?.exists
      ? {
          id: providerSnap.id,
          businessName: providerSnap.data()?.businessName || '',
          photoURL: providerSnap.data()?.photoURL || null,
        }
      : null;

    const client = clientSnap?.exists
      ? {
          id: clientSnap.id,
          displayName: clientSnap.data()?.displayName || '',
          email: clientSnap.data()?.email || '',
          photoURL: clientSnap.data()?.photoURL || null,
        }
      : null;

    // Serialize Firestore timestamps
    const booking: Record<string, any> = {
      id: bookingId,
      ...bookingData,
    };

    // Convert all Timestamp fields to ISO strings
    for (const key of ['datetime', 'createdAt', 'updatedAt', 'cancelledAt']) {
      if (booking[key]?.toDate) {
        booking[key] = booking[key].toDate().toISOString();
      }
    }

    // Flatten clientInfo name for convenience
    if (booking.clientInfo?.name) {
      booking.clientName = booking.clientInfo.name;
    }

    return NextResponse.json({ booking, provider, client });
  } catch (error) {
    console.error('[admin/bookings/[bookingId]] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Acc\u00e8s non autoris\u00e9' }, { status: 403 });
    }

    const { bookingId } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Read current booking to get old status
    const bookingDoc = await db.collection('bookings').doc(bookingId).get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: 'R\u00e9servation non trouv\u00e9e' }, { status: 404 });
    }

    const oldStatus = bookingDoc.data()?.status;
    if (oldStatus === newStatus) {
      return NextResponse.json({ error: 'Le statut est d\u00e9j\u00e0 \u00e0 jour' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = 'admin';
      updateData.cancelReason = 'Annul\u00e9 par l\'administrateur';
    }

    if (newStatus === 'noshow') {
      updateData.cancelledAt = new Date();
    }

    // Update booking document
    await db.collection('bookings').doc(bookingId).update(updateData);

    // Update stats/dashboard counters
    const statsUpdate: Record<string, any> = {};

    // Handle cancelledBookings counter
    if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
      statsUpdate.cancelledBookings = FieldValue.increment(-1);
    } else if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      statsUpdate.cancelledBookings = FieldValue.increment(1);
    }

    // Handle noshowBookings counter
    if (oldStatus === 'noshow' && newStatus !== 'noshow') {
      statsUpdate.noshowBookings = FieldValue.increment(-1);
    } else if (oldStatus !== 'noshow' && newStatus === 'noshow') {
      statsUpdate.noshowBookings = FieldValue.increment(1);
    }

    if (Object.keys(statsUpdate).length > 0) {
      await db.collection('stats').doc('dashboard').update(statsUpdate);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/bookings/[bookingId]] PATCH Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
