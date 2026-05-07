/**
 * Callable: runProviderStatsBackfill
 *
 * One-shot population of providerStats* + providerClients for a
 * given provider, using the same pure aggregation logic the trigger
 * uses for incremental updates. Idempotent — re-running overwrites
 * the affected docs from scratch.
 *
 * Invocation:
 *   const fn = httpsCallable(functions, 'runProviderStatsBackfill');
 *   await fn({ providerId: 'xyz' });
 *
 * Returns a summary { counts: { daily, monthly, rolling, clients }
 * + sample numbers } that the dev page can render to confirm the
 * write went through.
 *
 * Authentication: Cloud Functions callable enforces auth.uid by
 * default. We don't restrict to specific UIDs here because the
 * function is called from the /dev/* tools — gated by a separate
 * IAM-style admin check would be ideal but is left to the surrounding
 * app (current dev tools are admin-only by route convention).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  aggregateBookingsToClients,
  aggregateBookingsToDaily,
  aggregateDailiesToMonthly,
  aggregateRolling,
  bookingFromFirestore,
  clientDocId,
  dailyDocId,
  monthlyDocId,
  type BookingLike,
  type ProviderClient,
  type ProviderStatsDaily,
  type ProviderStatsMonthly,
  type ProviderStatsRolling,
} from '../lib/providerStatsAgg';

const DEFAULT_TIMEZONE = 'Europe/Paris';

interface BackfillRequest {
  providerId?: string;
  /**
   * Set to false to skip writes and just return the would-be totals.
   * Defaults to true (perform the backfill).
   */
  performWrites?: boolean;
}

interface BackfillResponse {
  providerId: string;
  ranAt: string;
  performedWrites: boolean;
  counts: {
    bookingsScanned: number;
    daily: number;
    monthly: number;
    clients: number;
    rolling: 1;
  };
  totalRevenue: number;
  firstDate: string | null;
  lastDate: string | null;
}

export const runProviderStatsBackfill = onCall<BackfillRequest, Promise<BackfillResponse>>(
  {
    region: 'europe-west1',
    timeoutSeconds: 540, // up to 9 minutes for very large providers
    memory: '512MiB',
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const providerId = req.data.providerId;
    if (!providerId || typeof providerId !== 'string') {
      throw new HttpsError('invalid-argument', 'providerId required');
    }
    const performWrites = req.data.performWrites !== false;

    const db = admin.firestore();

    // ── Load provider context ─────────────────────────────────
    const [providerSnap, membersSnap, bookingsSnap] = await Promise.all([
      db.doc(`providers/${providerId}`).get(),
      db.collection(`providers/${providerId}/members`).get(),
      db.collection('bookings').where('providerId', '==', providerId).get(),
    ]);
    if (!providerSnap.exists) {
      throw new HttpsError('not-found', `provider ${providerId} not found`);
    }
    const providerData = providerSnap.data() ?? {};
    const providerName = (providerData.businessName as string) ?? 'Provider';
    const membersById: Record<string, { name: string }> = {};
    for (const m of membersSnap.docs) {
      const d = m.data();
      membersById[m.id] = { name: (d.name as string) ?? '—' };
    }

    // ── Hydrate bookings ──────────────────────────────────────
    const bookings: BookingLike[] = bookingsSnap.docs.map((d) =>
      bookingFromFirestore(d.data()),
    );

    // ── Run the full pipeline ─────────────────────────────────
    const opts = { providerId, providerName, membersById, timezone: DEFAULT_TIMEZONE };
    const dailyMap = aggregateBookingsToDaily(bookings, opts);
    const dailyArr: ProviderStatsDaily[] = [...dailyMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const monthlyMap = aggregateDailiesToMonthly(dailyArr, providerId);
    const monthlyArr: ProviderStatsMonthly[] = [...monthlyMap.values()].sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    const rolling: ProviderStatsRolling = aggregateRolling(
      dailyArr,
      bookings,
      providerId,
      new Date(),
      DEFAULT_TIMEZONE,
    );

    // ── Resolve registered users for client enrichment ────────
    const userIds = new Set<string>();
    for (const b of bookings) if (b.clientId) userIds.add(b.clientId);
    const registeredUsers: Record<
      string,
      { displayName: string; photoURL: string | null; phone: string | null }
    > = {};
    if (userIds.size > 0) {
      // Firestore caps `in` at 30 — chunk if more.
      const ids = [...userIds];
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      for (const chunk of chunks) {
        const usersSnap = await db
          .collection('users')
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
          .get();
        for (const u of usersSnap.docs) {
          const d = u.data();
          registeredUsers[u.id] = {
            displayName: (d.displayName as string) ?? '',
            photoURL: (d.photoURL as string | null) ?? null,
            phone: (d.phone as string | null) ?? null,
          };
        }
      }
    }
    const clientMap = aggregateBookingsToClients(bookings, { providerId, registeredUsers });
    const clientArr: ProviderClient[] = [...clientMap.values()];

    const totalRevenue = dailyArr.reduce((s, d) => s + d.revenue, 0);
    const firstDate = dailyArr[0]?.date ?? null;
    const lastDate = dailyArr[dailyArr.length - 1]?.date ?? null;

    if (!performWrites) {
      return {
        providerId,
        ranAt: new Date().toISOString(),
        performedWrites: false,
        counts: {
          bookingsScanned: bookings.length,
          daily: dailyArr.length,
          monthly: monthlyArr.length,
          clients: clientArr.length,
          rolling: 1,
        },
        totalRevenue,
        firstDate,
        lastDate,
      };
    }

    // ── Batch write — 500 ops per batch ───────────────────────
    await commitBatched(db, [
      ...dailyArr.map((d) => ({
        ref: db.collection('providerStatsDaily').doc(dailyDocId(providerId, d.date)),
        data: d,
      })),
      ...monthlyArr.map((m) => ({
        ref: db.collection('providerStatsMonthly').doc(monthlyDocId(providerId, m.month)),
        data: m,
      })),
      {
        ref: db.collection('providerStatsRolling').doc(providerId),
        data: rolling,
      },
      ...clientArr.map((c) => ({
        ref: db.collection('providerClients').doc(clientDocId(providerId, c.clientKey)),
        data: c,
      })),
    ]);

    return {
      providerId,
      ranAt: new Date().toISOString(),
      performedWrites: true,
      counts: {
        bookingsScanned: bookings.length,
        daily: dailyArr.length,
        monthly: monthlyArr.length,
        clients: clientArr.length,
        rolling: 1,
      },
      totalRevenue,
      firstDate,
      lastDate,
    };
  },
);

/**
 * Firestore caps a single batch at 500 ops. Split + commit
 * sequentially. Sequential rather than parallel so a failure on
 * batch N doesn't leave us in a half-committed state at N+1.
 */
async function commitBatched(
  db: admin.firestore.Firestore,
  ops: { ref: admin.firestore.DocumentReference; data: unknown }[],
): Promise<void> {
  const CHUNK = 450; // a few ops of headroom
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      batch.set(op.ref, op.data as admin.firestore.DocumentData, { merge: false });
    }
    await batch.commit();
  }
}
