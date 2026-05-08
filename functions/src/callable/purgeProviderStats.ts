/**
 * Callable: purgeProviderStats
 *
 * Deletes every doc in providerStatsDaily, providerStatsMonthly,
 * providerStatsRolling and providerClients for one provider — or
 * for ALL providers when `allProviders: true` is set.
 *
 * Why a dedicated purge: the aggregated data is 100% derivable
 * from `bookings`, so wiping and re-running the backfill is a
 * safe rollback path. Useful for:
 *   - rolling back a botched deploy
 *   - schema migrations (purge + re-backfill with new shape)
 *   - decommissioning a provider's data on request (RGPD)
 *
 * Safety:
 *   - allProviders=true requires `confirm: 'PURGE_ALL_STATS'` in
 *     the request body. We never want a typo to nuke prod stats
 *     for everyone in a single click.
 *   - Per-client `notes` and `preferences` are NOT in here on
 *     purpose — they're user-edited content; purging would lose
 *     them. Callers who really want a hard wipe should add an
 *     explicit `includeUserEdits: true` flag if/when needed.
 *     Today's purge is a soft reset of derived data.
 *
 * Idempotent. Safe to call repeatedly.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface Request {
  /** Purge a single provider's stats. Required if !allProviders. */
  providerId?: string;
  /** Purge every provider's stats. Requires confirm token. */
  allProviders?: boolean;
  /** Confirmation token — must equal "PURGE_ALL_STATS" when allProviders=true. */
  confirm?: string;
}

interface PurgeCounts {
  daily: number;
  monthly: number;
  rolling: number;
  clients: number;
  /** pageViewsMonthly docs deleted (pageViewsDaily is NOT touched —
   *  it's the upstream source maintained by aggregatePageViews and
   *  serves both /pro/statistiques and the public profile). */
  pageViewsMonthly: number;
}

interface Response {
  ranAt: string;
  scope: 'one' | 'all';
  providersAffected: number;
  totals: PurgeCounts;
}

export const purgeProviderStats = onCall<Request, Promise<Response>>(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const db = admin.firestore();
    const totals: PurgeCounts = { daily: 0, monthly: 0, rolling: 0, clients: 0, pageViewsMonthly: 0 };

    // Single-provider scope
    if (!req.data.allProviders) {
      const providerId = req.data.providerId;
      if (!providerId) {
        throw new HttpsError('invalid-argument', 'providerId required');
      }
      const c = await purgeOne(db, providerId);
      totals.daily += c.daily;
      totals.monthly += c.monthly;
      totals.rolling += c.rolling;
      totals.clients += c.clients;
      return {
        ranAt: new Date().toISOString(),
        scope: 'one',
        providersAffected: 1,
        totals,
      };
    }

    // All-providers scope — guarded by confirm token.
    if (req.data.confirm !== 'PURGE_ALL_STATS') {
      throw new HttpsError(
        'failed-precondition',
        'Set confirm: "PURGE_ALL_STATS" to wipe every provider',
      );
    }
    const providersSnap = await db.collection('providers').get();
    for (const providerDoc of providersSnap.docs) {
      const c = await purgeOne(db, providerDoc.id);
      totals.daily += c.daily;
      totals.monthly += c.monthly;
      totals.rolling += c.rolling;
      totals.clients += c.clients;
    }
    return {
      ranAt: new Date().toISOString(),
      scope: 'all',
      providersAffected: providersSnap.size,
      totals,
    };
  },
);

async function purgeOne(
  db: admin.firestore.Firestore,
  providerId: string,
): Promise<PurgeCounts> {
  const counts: PurgeCounts = { daily: 0, monthly: 0, rolling: 0, clients: 0, pageViewsMonthly: 0 };

  // Fetch + delete in chunks (Firestore caps batches at 500 ops).
  const collections = [
    { name: 'providerStatsDaily', counter: 'daily' as const },
    { name: 'providerStatsMonthly', counter: 'monthly' as const },
    { name: 'providerClients', counter: 'clients' as const },
    { name: 'pageViewsMonthly', counter: 'pageViewsMonthly' as const },
  ];

  for (const coll of collections) {
    const snap = await db
      .collection(coll.name)
      .where('providerId', '==', providerId)
      .get();
    if (snap.empty) continue;
    counts[coll.counter] = snap.size;
    // Chunk into 450 to leave headroom in the batch.
    const refs = snap.docs.map((d) => d.ref);
    for (let i = 0; i < refs.length; i += 450) {
      const batch = db.batch();
      for (const r of refs.slice(i, i + 450)) batch.delete(r);
      await batch.commit();
    }
  }

  // Rolling is a single doc keyed on the providerId.
  const rollingRef = db.collection('providerStatsRolling').doc(providerId);
  const rollingSnap = await rollingRef.get();
  if (rollingSnap.exists) {
    counts.rolling = 1;
    await rollingRef.delete();
  }

  return counts;
}
