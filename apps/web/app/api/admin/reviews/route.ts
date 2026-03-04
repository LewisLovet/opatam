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
    const minRating = searchParams.get('minRating') ? parseInt(searchParams.get('minRating')!) : null;
    const maxRating = searchParams.get('maxRating') ? parseInt(searchParams.get('maxRating')!) : null;
    const isPublic = searchParams.get('isPublic');
    const providerId = searchParams.get('providerId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query with Firestore-level filters where possible
    let query: FirebaseFirestore.Query = db.collection('reviews');

    if (providerId) {
      query = query.where('providerId', '==', providerId);
    }

    if (isPublic === 'true') {
      query = query.where('isPublic', '==', true);
    } else if (isPublic === 'false') {
      query = query.where('isPublic', '==', false);
    }

    // Order + safety limit (max 500 docs loaded)
    query = query.orderBy('createdAt', 'desc').limit(500);

    const snapshot = await query.get();

    let items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        providerId: data.providerId,
        clientId: data.clientId || null,
        clientName: data.clientName || '',
        clientPhoto: data.clientPhoto || null,
        rating: data.rating,
        comment: data.comment || null,
        isPublic: data.isPublic || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // In-memory date filters
    if (dateFrom) {
      const from = new Date(dateFrom);
      items = items.filter((r) => r.createdAt && new Date(r.createdAt) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      items = items.filter((r) => r.createdAt && new Date(r.createdAt) < to);
    }

    // In-memory filters (text search + rating range)
    if (search) {
      items = items.filter(
        (r) => r.clientName?.toLowerCase().includes(search)
      );
    }

    if (minRating !== null) {
      items = items.filter((r) => r.rating >= minRating);
    }

    if (maxRating !== null) {
      items = items.filter((r) => r.rating <= maxRating);
    }

    // Pagination
    const total = items.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + pageSize);

    // Batch fetch provider names for paginated items
    const uniqueProviderIds = [...new Set(paginatedItems.map((r) => r.providerId).filter(Boolean))];
    const providerNames: Record<string, string> = {};

    if (uniqueProviderIds.length > 0) {
      // Firestore getAll supports up to 500 docs
      const providerRefs = uniqueProviderIds.map((id) => db.collection('providers').doc(id));
      const providerDocs = await db.getAll(...providerRefs);
      providerDocs.forEach((doc) => {
        if (doc.exists) {
          providerNames[doc.id] = doc.data()?.businessName || 'Inconnu';
        }
      });
    }

    const itemsWithProviderName = paginatedItems.map((r) => ({
      ...r,
      providerName: providerNames[r.providerId] || 'Inconnu',
    }));

    return NextResponse.json({
      items: itemsWithProviderName,
      total,
      page,
      pageSize,
      hasMore: startIndex + pageSize < total,
    });
  } catch (error) {
    console.error('[admin/reviews] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
