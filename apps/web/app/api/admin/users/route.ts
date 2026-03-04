import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search')?.toLowerCase() || '';
    const role = searchParams.get('role') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const city = searchParams.get('city')?.toLowerCase() || '';

    // Build query with Firestore-level filters where possible
    let query: FirebaseFirestore.Query = db.collection('users');

    // Role filter in Firestore (avoids loading irrelevant docs)
    // Note: 'both' users count as both client and provider
    if (role === 'client') {
      query = query.where('role', 'in', ['client', 'both']);
    } else if (role === 'provider') {
      query = query.where('role', 'in', ['provider', 'both']);
    }

    // Date filters in Firestore
    if (dateFrom) {
      query = query.where('createdAt', '>=', new Date(dateFrom));
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.where('createdAt', '<', endDate);
    }

    // Order + safety limit (max 500 docs loaded)
    query = query.orderBy('createdAt', 'desc').limit(500);

    const snapshot = await query.get();

    let items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        displayName: data.displayName,
        phone: data.phone,
        photoURL: data.photoURL,
        role: data.role,
        providerId: data.providerId,
        city: data.city,
        isAdmin: data.isAdmin || false,
        isDisabled: data.isDisabled || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // In-memory filters (text search + city — Firestore doesn't support full-text search)
    if (search) {
      items = items.filter(
        (u) =>
          u.email?.toLowerCase().includes(search) ||
          u.displayName?.toLowerCase().includes(search) ||
          u.phone?.includes(search)
      );
    }

    if (city) {
      items = items.filter((u) => u.city?.toLowerCase().includes(city));
    }

    // Pagination
    const total = items.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      items: paginatedItems,
      total,
      page,
      pageSize,
      hasMore: startIndex + pageSize < total,
    });
  } catch (error) {
    console.error('[admin/users] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
