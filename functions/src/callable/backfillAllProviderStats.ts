/**
 * Callable: backfillAllProviderStats
 *
 * Iterates every provider in the platform and runs the
 * `backfillProviderStats` core against each, sequentially. Used
 * for the initial Phase 1B rollout (populate everyone's stats
 * collections in one shot) and for any future schema migration
 * that requires a full re-aggregation.
 *
 * Sequential rather than parallel to keep Firestore reads under
 * control and avoid hammering quotas with a 1000-provider parallel
 * fan-out. A per-provider failure is logged but does NOT abort the
 * batch — we collect a list of failed IDs in the response so the
 * caller can retry just those.
 *
 * Budget: 9 minutes. At ~2s/provider on average, that comfortably
 * fits ~250 providers in a single call. Above that we'd switch to
 * a cursor-based resume scheme — left as a follow-up since we're
 * far from that scale today.
 *
 * Auth: callable enforces auth.uid by default. Tighter admin-only
 * gating (e.g. allowlist by uid) is left to the surrounding app —
 * the function is currently invoked from the /dev/* tools which
 * are admin-only by route convention.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { backfillProviderStats } from './runProviderStatsBackfill';

interface Request {
  /**
   * Optional filter — only providers with `isPublished == true`.
   * Defaults to false (process every provider, draft or live).
   */
  publishedOnly?: boolean;
}

interface PerProviderResult {
  providerId: string;
  businessName: string;
  ok: boolean;
  durationMs: number;
  bookingsScanned: number;
  totalRevenue: number;
  error?: string;
}

interface Response {
  ranAt: string;
  totalDurationMs: number;
  totalProviders: number;
  successes: number;
  failures: number;
  results: PerProviderResult[];
}

export const backfillAllProviderStats = onCall<Request, Promise<Response>>(
  {
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '1GiB', // bumped vs single backfill — we hold N provider results
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const startedAt = Date.now();
    const db = admin.firestore();

    let providersQuery: admin.firestore.Query = db.collection('providers');
    if (req.data.publishedOnly) {
      providersQuery = providersQuery.where('isPublished', '==', true);
    }
    const providersSnap = await providersQuery.get();

    const results: PerProviderResult[] = [];
    let successes = 0;
    let failures = 0;

    for (const providerDoc of providersSnap.docs) {
      const providerId = providerDoc.id;
      const businessName =
        (providerDoc.data().businessName as string) ?? 'Provider';
      const t0 = Date.now();
      try {
        const r = await backfillProviderStats(db, providerId, true);
        results.push({
          providerId,
          businessName,
          ok: true,
          durationMs: Date.now() - t0,
          bookingsScanned: r.counts.bookingsScanned,
          totalRevenue: r.totalRevenue,
        });
        successes += 1;
      } catch (err) {
        results.push({
          providerId,
          businessName,
          ok: false,
          durationMs: Date.now() - t0,
          bookingsScanned: 0,
          totalRevenue: 0,
          error: err instanceof Error ? err.message : String(err),
        });
        failures += 1;
        console.error(
          `[backfillAllProviderStats] ${providerId} failed:`,
          err,
        );
      }
    }

    return {
      ranAt: new Date().toISOString(),
      totalDurationMs: Date.now() - startedAt,
      totalProviders: providersSnap.size,
      successes,
      failures,
      results,
    };
  },
);
