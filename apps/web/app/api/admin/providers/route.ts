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
    const plan = searchParams.get('plan') || '';
    const isPublished = searchParams.get('isPublished') || 'all';
    const isVerified = searchParams.get('isVerified') || 'all';
    const category = searchParams.get('category') || '';

    // Build query with Firestore-level filters where possible
    let query: FirebaseFirestore.Query = db.collection('providers');

    // Boolean filters in Firestore (most selective)
    if (isPublished !== 'all') {
      query = query.where('isPublished', '==', isPublished === 'true');
    }
    if (isVerified !== 'all') {
      query = query.where('isVerified', '==', isVerified === 'true');
    }

    // Category filter in Firestore
    if (category) {
      query = query.where('category', '==', category);
    }

    // Order + safety limit (max 500 docs loaded)
    query = query.orderBy('createdAt', 'desc').limit(500);

    const snapshot = await query.get();

    let items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        businessName: data.businessName,
        category: data.category,
        slug: data.slug,
        photoURL: data.photoURL,
        plan: data.subscription?.plan || data.plan,
        subscriptionStatus: data.subscription?.status || null,
        isPublished: data.isPublished || false,
        isVerified: data.isVerified || false,
        rating: data.rating || { average: 0, count: 0 },
        cities: data.cities || [],
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // In-memory filters (text search + plan — can't combine with other where clauses easily)
    if (search) {
      items = items.filter(
        (p) =>
          p.businessName?.toLowerCase().includes(search) ||
          p.slug?.toLowerCase().includes(search)
      );
    }

    if (plan) {
      items = items.filter((p) => p.plan === plan);
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
    console.error('[admin/providers] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
