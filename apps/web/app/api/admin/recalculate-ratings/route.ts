import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

type Distribution = { 1: number; 2: number; 3: number; 4: number; 5: number };

/**
 * POST /api/admin/recalculate-ratings — one-shot backfill.
 *
 * Recomputes `provider.rating` for every provider based on the current
 * contents of the `reviews` collection. Normally not needed — the
 * `onReviewRatingUpdate` Cloud Function trigger keeps ratings in sync
 * on every review write. This endpoint exists for:
 *   - fixing historical data that was miscounted because of the older
 *     client-side recalculation that could fail silently
 *   - disaster-recovery if ratings drift for any reason
 *
 * Body (optional): { providerId?: string }
 *   - if providerId is provided, recomputes only that provider
 *   - otherwise recomputes every provider in the database
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const singleProviderId: string | undefined = body?.providerId;

    const db = getAdminFirestore();

    // Determine which providers to recalc
    let providerIds: string[];
    if (singleProviderId) {
      providerIds = [singleProviderId];
    } else {
      const snap = await db.collection('providers').select().get();
      providerIds = snap.docs.map((d) => d.id);
    }

    const results: Array<{
      providerId: string;
      count: number;
      average: number;
      changed: boolean;
    }> = [];

    for (const providerId of providerIds) {
      const reviewsSnap = await db
        .collection('reviews')
        .where('providerId', '==', providerId)
        .where('isPublic', '==', true)
        .get();

      const distribution: Distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      let count = 0;
      reviewsSnap.forEach((doc) => {
        const rating = doc.data().rating as number;
        if (rating >= 1 && rating <= 5) {
          distribution[rating as 1 | 2 | 3 | 4 | 5]++;
          total += rating;
          count++;
        }
      });
      const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

      // Read current rating to detect changes
      const providerRef = db.collection('providers').doc(providerId);
      const providerDoc = await providerRef.get();
      if (!providerDoc.exists) continue;

      const currentRating = providerDoc.data()?.rating ?? null;
      const changed =
        !currentRating ||
        currentRating.count !== count ||
        currentRating.average !== average;

      if (changed) {
        await providerRef.update({
          rating: { average, count, distribution },
          updatedAt: new Date(),
        });
      }

      results.push({ providerId, count, average, changed });
    }

    const fixed = results.filter((r) => r.changed).length;

    return NextResponse.json({
      success: true,
      scanned: results.length,
      fixed,
      results: singleProviderId ? results : results.filter((r) => r.changed),
    });
  } catch (error) {
    console.error('[admin/recalculate-ratings] Error:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
