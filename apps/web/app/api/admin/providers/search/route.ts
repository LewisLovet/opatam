import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/**
 * GET /api/admin/providers/search?q=...
 *
 * Lightweight autocomplete endpoint used by the admin affiliate creation
 * modal to prefill the new-affiliate form from an existing provider.
 *
 * - Searches providers by businessName (case-insensitive substring)
 * - Returns up to 10 results
 * - Joins each provider with its owning user to surface `email` and
 *   `displayName` (which aren't on the provider doc itself)
 * - Flags providers that are already affiliated (`alreadyAffiliate: true`)
 *   so the UI can warn the admin before creating a duplicate
 */
interface SearchResult {
  id: string;
  userId: string;
  businessName: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  alreadyAffiliate: boolean;
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

    const { searchParams } = request.nextUrl;
    const q = (searchParams.get('q') ?? '').trim().toLowerCase();

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const db = getAdminFirestore();

    // Firestore doesn't support substring queries natively. Instead we scan
    // the most recent 500 providers and filter in-memory on businessName +
    // slug. 500 is enough for the current scale (a few thousand providers
    // at most). For larger scale we'd switch to Algolia/Typesense.
    const snap = await db
      .collection('providers')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const matches = snap.docs
      .map((doc) => {
        const d = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          userId: (d.userId as string) ?? doc.id,
          businessName: (d.businessName as string) ?? '',
          slug: (d.slug as string) ?? '',
          photoURL: (d.photoURL as string | null) ?? null,
          affiliateId: (d.affiliateId as string | null) ?? null,
        };
      })
      .filter(
        (p) =>
          p.businessName.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q),
      )
      .slice(0, 10);

    if (matches.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Join with user docs to get email + displayName. Batch into `in`
    // queries of max 10 (Firestore limit).
    const userIds = matches.map((m) => m.userId);
    const userDocs = await Promise.all(
      userIds.map((uid) => db.collection('users').doc(uid).get()),
    );
    const userByUid = new Map<string, { email?: string; displayName?: string }>();
    userDocs.forEach((u, i) => {
      if (u.exists) {
        const ud = u.data() as Record<string, unknown>;
        userByUid.set(userIds[i], {
          email: ud.email as string | undefined,
          displayName: ud.displayName as string | undefined,
        });
      }
    });

    const results: SearchResult[] = matches.map((m) => {
      const u = userByUid.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        businessName: m.businessName,
        email: u?.email ?? null,
        displayName: u?.displayName ?? null,
        photoURL: m.photoURL,
        alreadyAffiliate: !!m.affiliateId,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[admin/providers/search] Error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
