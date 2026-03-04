import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { userId } = await params;
    const db = getAdminFirestore();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // Get bookings — select only needed fields to reduce bandwidth
    const bookingsSnap = await db.collection('bookings')
      .where('clientId', '==', userId)
      .select('providerId', 'providerName', 'serviceName', 'datetime', 'status', 'price', 'createdAt')
      .get();

    const bookingsCount = bookingsSnap.size;

    // Sort in memory and take 20 most recent
    const recentBookings = bookingsSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          providerId: data.providerId,
          providerName: data.providerName,
          serviceName: data.serviceName,
          datetime: data.datetime?.toDate?.()?.toISOString() || null,
          status: data.status,
          price: data.price,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 20);

    return NextResponse.json({
      user: {
        id: userId,
        email: userData.email,
        displayName: userData.displayName,
        phone: userData.phone,
        photoURL: userData.photoURL,
        role: userData.role,
        providerId: userData.providerId,
        city: userData.city,
        birthYear: userData.birthYear,
        gender: userData.gender,
        cancellationCount: userData.cancellationCount || 0,
        isAdmin: userData.isAdmin || false,
        isDisabled: userData.isDisabled || false,
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: userData.updatedAt?.toDate?.()?.toISOString() || null,
      },
      bookingsCount,
      recentBookings,
    });
  } catch (error) {
    console.error('[admin/users/[userId]] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const db = getAdminFirestore();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Only allow toggling isDisabled
    const updateData: Record<string, any> = {};
    if (typeof body.disabled === 'boolean') {
      updateData.isDisabled = body.disabled;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
    }

    updateData.updatedAt = new Date();
    await db.collection('users').doc(userId).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/users/[userId]] PATCH Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
