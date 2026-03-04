/**
 * Triggers: Admin Dashboard Stats Aggregation
 *
 * Maintains a pre-computed stats/dashboard document in Firestore.
 * Instead of scanning entire collections on each dashboard load,
 * these triggers update counters incrementally on each write.
 *
 * Document: stats/dashboard
 * Fields:
 *   - totalUsers, totalClients, totalProviders
 *   - activeProviders
 *   - totalBookings, cancelledBookings, noshowBookings
 *   - totalReviews, ratingSum
 *   - trialProviders, convertedProviders
 *   - bookingsByCategory: { [category]: count }
 *   - updatedAt
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const STATS_DOC = 'stats/dashboard';

// ─── User triggers ─────────────────────────────────────────────────────────────

export const onUserWrite = onDocumentWritten(
  {
    document: 'users/{userId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const db = admin.firestore();
    const statsRef = db.doc(STATS_DOC);
    const updates: Record<string, FieldValue | Date> = {};

    const wasClient = before?.role === 'client' || before?.role === 'both';
    const isClient = after?.role === 'client' || after?.role === 'both';
    const wasProvider = before?.role === 'provider' || before?.role === 'both';
    const isProvider = after?.role === 'provider' || after?.role === 'both';

    // User created
    if (!before && after) {
      updates.totalUsers = FieldValue.increment(1);
    }

    // User deleted
    if (before && !after) {
      updates.totalUsers = FieldValue.increment(-1);
    }

    // Client count delta
    if (!wasClient && isClient) updates.totalClients = FieldValue.increment(1);
    if (wasClient && !isClient) updates.totalClients = FieldValue.increment(-1);

    // Provider count delta
    if (!wasProvider && isProvider) updates.totalProviders = FieldValue.increment(1);
    if (wasProvider && !isProvider) updates.totalProviders = FieldValue.increment(-1);

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await statsRef.set(updates, { merge: true });
      console.log('[onUserWrite] Stats updated:', Object.keys(updates).join(', '));
    }
  }
);

// ─── Provider triggers ──────────────────────────────────────────────────────────

export const onProviderWrite = onDocumentWritten(
  {
    document: 'providers/{providerId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const db = admin.firestore();
    const statsRef = db.doc(STATS_DOC);
    const updates: Record<string, FieldValue | Date> = {};

    const wasPub = before?.isPublished === true;
    const isPub = after?.isPublished === true;

    // Published status changed
    if (!wasPub && isPub) {
      updates.activeProviders = FieldValue.increment(1);
    } else if (wasPub && !isPub) {
      updates.activeProviders = FieldValue.increment(-1);
    }

    // Provider deleted (was published)
    if (before && !after && wasPub) {
      updates.activeProviders = FieldValue.increment(-1);
    }

    // Subscription changes for trial conversion tracking
    const beforePlan = before?.subscription?.plan;
    const afterPlan = after?.subscription?.plan;
    const beforeStatus = before?.subscription?.status;
    const afterStatus = after?.subscription?.status;

    const wasTrial = beforePlan === 'trial' || beforeStatus === 'trialing';
    const isTrial = afterPlan === 'trial' || afterStatus === 'trialing';
    const wasConverted = beforePlan && beforePlan !== 'trial' && beforePlan !== 'test' && beforeStatus === 'active';
    const isConverted = afterPlan && afterPlan !== 'trial' && afterPlan !== 'test' && afterStatus === 'active';

    // Trial count changes
    if (!before && isTrial) updates.trialProviders = FieldValue.increment(1);
    if (before && !after && wasTrial) updates.trialProviders = FieldValue.increment(-1);
    if (before && after) {
      if (!wasTrial && isTrial) updates.trialProviders = FieldValue.increment(1);
      if (wasTrial && !isTrial) updates.trialProviders = FieldValue.increment(-1);
    }

    // Converted count changes
    if (!before && isConverted) updates.convertedProviders = FieldValue.increment(1);
    if (before && !after && wasConverted) updates.convertedProviders = FieldValue.increment(-1);
    if (before && after) {
      if (!wasConverted && isConverted) updates.convertedProviders = FieldValue.increment(1);
      if (wasConverted && !isConverted) updates.convertedProviders = FieldValue.increment(-1);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await statsRef.set(updates, { merge: true });
      console.log('[onProviderWrite] Stats updated:', Object.keys(updates).join(', '));
    }
  }
);

// ─── Booking triggers ───────────────────────────────────────────────────────────

export const onBookingWriteStats = onDocumentWritten(
  {
    document: 'bookings/{bookingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const db = admin.firestore();
    const statsRef = db.doc(STATS_DOC);
    const updates: Record<string, FieldValue | Date> = {};

    // Booking created
    if (!before && after) {
      updates.totalBookings = FieldValue.increment(1);
      if (after.status === 'cancelled') updates.cancelledBookings = FieldValue.increment(1);
      if (after.status === 'noshow') updates.noshowBookings = FieldValue.increment(1);

      // Category tracking: store providerId → we need category from provider
      const providerId = after.providerId;
      if (providerId) {
        try {
          const providerDoc = await db.collection('providers').doc(providerId).get();
          const category = providerDoc.data()?.category || 'Autre';
          updates[`bookingsByCategory.${category}`] = FieldValue.increment(1);
        } catch (err) {
          console.error('[onBookingWriteStats] Error fetching provider category:', err);
        }
      }
    }

    // Booking deleted
    if (before && !after) {
      updates.totalBookings = FieldValue.increment(-1);
      if (before.status === 'cancelled') updates.cancelledBookings = FieldValue.increment(-1);
      if (before.status === 'noshow') updates.noshowBookings = FieldValue.increment(-1);

      const providerId = before.providerId;
      if (providerId) {
        try {
          const providerDoc = await db.collection('providers').doc(providerId).get();
          const category = providerDoc.data()?.category || 'Autre';
          updates[`bookingsByCategory.${category}`] = FieldValue.increment(-1);
        } catch (err) {
          console.error('[onBookingWriteStats] Error fetching provider category:', err);
        }
      }
    }

    // Status changed
    if (before && after && before.status !== after.status) {
      if (before.status === 'cancelled') updates.cancelledBookings = FieldValue.increment(-1);
      if (before.status === 'noshow') updates.noshowBookings = FieldValue.increment(-1);
      if (after.status === 'cancelled') updates.cancelledBookings = FieldValue.increment(1);
      if (after.status === 'noshow') updates.noshowBookings = FieldValue.increment(1);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await statsRef.set(updates, { merge: true });
      console.log('[onBookingWriteStats] Stats updated:', Object.keys(updates).join(', '));
    }
  }
);

// ─── Review triggers ────────────────────────────────────────────────────────────

export const onReviewWrite = onDocumentWritten(
  {
    document: 'reviews/{reviewId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const db = admin.firestore();
    const statsRef = db.doc(STATS_DOC);
    const updates: Record<string, FieldValue | Date> = {};

    // Review created
    if (!before && after) {
      updates.totalReviews = FieldValue.increment(1);
      updates.ratingSum = FieldValue.increment(after.rating || 0);
    }

    // Review deleted
    if (before && !after) {
      updates.totalReviews = FieldValue.increment(-1);
      updates.ratingSum = FieldValue.increment(-(before.rating || 0));
    }

    // Rating changed
    if (before && after && before.rating !== after.rating) {
      const diff = (after.rating || 0) - (before.rating || 0);
      updates.ratingSum = FieldValue.increment(diff);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      await statsRef.set(updates, { merge: true });
      console.log('[onReviewWrite] Stats updated:', Object.keys(updates).join(', '));
    }
  }
);
