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
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Acc\u00e8s non autoris\u00e9' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'all';
    const providerId = searchParams.get('providerId') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query — apply status filter in Firestore, dates in memory
    let query: FirebaseFirestore.Query = db.collection('bookings');

    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    if (providerId) {
      query = query.where('providerId', '==', providerId);
    }

    // Order + safety limit (max 500 docs loaded)
    query = query
      .orderBy('datetime', 'desc')
      .select(
        'clientInfo',
        'providerName',
        'serviceName',
        'datetime',
        'status',
        'price',
        'providerId',
        'clientId',
        'createdAt'
      )
      .limit(500);

    const snapshot = await query.get();

    let items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        clientName: data.clientInfo?.name || 'Client inconnu',
        clientId: data.clientId || null,
        providerId: data.providerId || null,
        providerName: data.providerName || 'Prestataire inconnu',
        serviceName: data.serviceName || '',
        datetime: data.datetime?.toDate?.()?.toISOString() || null,
        status: data.status,
        price: data.price || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // In-memory date filters
    if (dateFrom) {
      const from = new Date(dateFrom);
      items = items.filter((b) => b.datetime && new Date(b.datetime) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      items = items.filter((b) => b.datetime && new Date(b.datetime) < to);
    }

    // In-memory search filter
    if (search) {
      items = items.filter(
        (b) =>
          b.clientName?.toLowerCase().includes(search) ||
          b.providerName?.toLowerCase().includes(search) ||
          b.serviceName?.toLowerCase().includes(search)
      );
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
    console.error('[admin/bookings] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
