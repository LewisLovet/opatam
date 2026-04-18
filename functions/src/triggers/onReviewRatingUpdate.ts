/**
 * Trigger: onReviewRatingUpdate
 *
 * Single source of truth for `provider.rating`. Fires on any create,
 * update or delete of a review document and recalculates the aggregate
 * rating (average, count, distribution) for the affected provider(s)
 * by reading back the full set of public reviews.
 *
 * This replaces the previous client-side / API-route recalculation that
 * was running in `reviewService` and `/api/reviews/submit`, which could
 * silently fail when triggered from the mobile client (Firestore rules
 * deny writes on `providers/{id}` from non-owner clients).
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

type Distribution = { 1: number; 2: number; 3: number; 4: number; 5: number };

async function recalculateProviderRating(
  db: admin.firestore.Firestore,
  providerId: string
): Promise<void> {
  const snapshot = await db
    .collection('reviews')
    .where('providerId', '==', providerId)
    .where('isPublic', '==', true)
    .get();

  const distribution: Distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let count = 0;

  snapshot.forEach((doc) => {
    const rating = doc.data().rating as number;
    if (rating >= 1 && rating <= 5) {
      distribution[rating as 1 | 2 | 3 | 4 | 5]++;
      total += rating;
      count++;
    }
  });

  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  await db.collection('providers').doc(providerId).update({
    rating: { average, count, distribution },
    updatedAt: new Date(),
  });

  console.log(
    `[onReviewRatingUpdate] Provider ${providerId}: count=${count}, average=${average}`
  );
}

export const onReviewRatingUpdate = onDocumentWritten(
  {
    document: 'reviews/{reviewId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const db = admin.firestore();

    // Collect all providerIds impacted by this write. Normally both are the
    // same, but if a review's providerId is ever changed we must recalc both
    // the old and the new provider.
    const providerIds = new Set<string>();
    if (before?.providerId) providerIds.add(before.providerId as string);
    if (after?.providerId) providerIds.add(after.providerId as string);

    if (providerIds.size === 0) return;

    try {
      await Promise.all(
        Array.from(providerIds).map((pid) => recalculateProviderRating(db, pid))
      );
    } catch (err) {
      console.error('[onReviewRatingUpdate] Error:', err);
    }
  }
);
