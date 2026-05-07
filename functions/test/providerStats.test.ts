/**
 * Integration tests — provider stats backfill.
 *
 * Runs against a real Firestore emulator (no mocks). The setup is:
 *   firebase emulators:exec --only firestore "vitest run"
 * which sets FIRESTORE_EMULATOR_HOST=localhost:8080 in env, and
 * the firebase-admin SDK below auto-detects and routes all reads
 * + writes to the emulator instead of prod.
 *
 * Each test wipes the relevant collections in `beforeEach` so the
 * order doesn't matter and a failing test never leaves residue
 * for the next one. The emulator is shared across tests but the
 * data is isolated per test.
 *
 * What we cover:
 *  - Revenue rule: confirmed only, all other statuses ignored.
 *  - Daily aggregation: one doc per (provider, calendar day).
 *  - Monthly + rolling produced and Firestore-compatible (no
 *    nested arrays — the regression test for the bug we hit on
 *    first deploy).
 *  - Clients aggregation: dedupes by email, anonymous bookings
 *    skipped.
 *  - notes / preferences are preserved across re-runs of the
 *    backfill (read-modify-write contract).
 *
 * What we DON'T cover yet (intentionally — separate test files
 * later if needed):
 *  - The trigger's incremental updates (would need a second
 *    emulator config + functions emulator).
 *  - The cron scheduled function.
 *  - Edge cases around timezone boundaries.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

import { backfillProviderStats } from '../src/callable/runProviderStatsBackfill';

// ────────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────────

const PROJECT_ID = 'test-stats';
const PROVIDER_ID = 'p-test-1';

let db: admin.firestore.Firestore;

beforeAll(() => {
  // The emulator host comes from env (set by `firebase emulators:exec`).
  // We hard-fail if it's missing so a misconfigured run doesn't
  // accidentally hit prod.
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'FIRESTORE_EMULATOR_HOST is not set. Run via `pnpm test:stats` so the emulator is started for you.',
    );
  }
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  db = admin.firestore();
});

beforeEach(async () => {
  await Promise.all([
    wipeCollection('bookings'),
    wipeCollection('providers'),
    wipeCollection('users'),
    wipeCollection('providerStatsDaily'),
    wipeCollection('providerStatsMonthly'),
    wipeCollection('providerStatsRolling'),
    wipeCollection('providerClients'),
  ]);
  // Members are a sub-collection — wipe via the parent if there's
  // residue from a previous run.
  const subSnap = await db
    .collection('providers')
    .doc(PROVIDER_ID)
    .collection('members')
    .get();
  await Promise.all(subSnap.docs.map((d) => d.ref.delete()));
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

async function wipeCollection(path: string): Promise<void> {
  const snap = await db.collection(path).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

interface SeedBookingInput {
  id?: string;
  status?: 'confirmed' | 'pending' | 'cancelled' | 'noshow' | 'pending_payment';
  price?: number;
  datetime?: Date;
  createdAt?: Date;
  serviceId?: string;
  serviceName?: string;
  memberId?: string | null;
  memberName?: string | null;
  clientEmail?: string | null;
  clientName?: string;
  clientId?: string | null;
  marketingOptIn?: boolean;
}

async function seedProvider(): Promise<void> {
  await db.doc(`providers/${PROVIDER_ID}`).set({
    businessName: 'Test Salon',
    category: 'beauty',
    isPublished: true,
  });
}

async function seedBooking(input: SeedBookingInput = {}): Promise<string> {
  const id = input.id ?? `b-${Math.random().toString(36).slice(2, 10)}`;
  const datetime = input.datetime ?? new Date('2026-04-15T10:00:00Z');
  const createdAt = input.createdAt ?? datetime;
  await db.doc(`bookings/${id}`).set({
    providerId: PROVIDER_ID,
    clientId: input.clientId ?? null,
    memberId: input.memberId ?? null,
    providerName: 'Test Salon',
    memberName: input.memberName ?? null,
    serviceId: input.serviceId ?? 's1',
    serviceName: input.serviceName ?? 'Coupe',
    duration: 60,
    price: input.price ?? 4000,
    priceMax: null,
    locationId: 'l1',
    locationName: 'Test',
    locationAddress: '1 rue test',
    clientInfo: {
      name: input.clientName ?? 'Anon',
      email: input.clientEmail ?? '',
      ...(input.marketingOptIn !== undefined
        ? { marketingOptIn: input.marketingOptIn }
        : {}),
    },
    datetime: Timestamp.fromDate(datetime),
    endDatetime: Timestamp.fromDate(new Date(datetime.getTime() + 60 * 60 * 1000)),
    status: input.status ?? 'confirmed',
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    cancelToken: null,
    remindersSent: [],
    reviewRequestSentAt: null,
    createdAt: Timestamp.fromDate(createdAt),
    updatedAt: Timestamp.fromDate(createdAt),
  });
  return id;
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('backfillProviderStats', () => {
  it('rejects when the provider does not exist', async () => {
    await expect(backfillProviderStats(db, 'nope', true)).rejects.toThrow(
      /provider nope not found/,
    );
  });

  it('produces an empty result for a provider with no bookings', async () => {
    await seedProvider();
    const result = await backfillProviderStats(db, PROVIDER_ID, true);

    expect(result.counts.bookingsScanned).toBe(0);
    expect(result.counts.daily).toBe(0);
    expect(result.counts.monthly).toBe(0);
    expect(result.counts.clients).toBe(0);
    expect(result.totalRevenue).toBe(0);
  });

  it('counts only `confirmed` bookings toward revenue', async () => {
    await seedProvider();
    await seedBooking({ status: 'confirmed', price: 5000, clientEmail: 'a@x.com' });
    await seedBooking({ status: 'pending', price: 9999, clientEmail: 'b@x.com' });
    await seedBooking({ status: 'cancelled', price: 9999, clientEmail: 'c@x.com' });
    await seedBooking({ status: 'noshow', price: 9999, clientEmail: 'd@x.com' });
    await seedBooking({ status: 'pending_payment', price: 9999, clientEmail: 'e@x.com' });

    const result = await backfillProviderStats(db, PROVIDER_ID, true);

    expect(result.counts.bookingsScanned).toBe(5);
    // Only the one confirmed booking contributes to revenue.
    expect(result.totalRevenue).toBe(5000);

    // Daily doc reflects status breakdown correctly.
    const dayKey = '2026-04-15'; // Europe/Paris is +2 in April so 10:00Z = 12:00 local same day
    const daily = await db.doc(`providerStatsDaily/${PROVIDER_ID}_${dayKey}`).get();
    expect(daily.exists).toBe(true);
    const d = daily.data()!;
    expect(d.bookingsCount).toBe(5);
    expect(d.confirmedCount).toBe(1);
    expect(d.pendingCount).toBe(1);
    expect(d.cancelledCount).toBe(1);
    expect(d.noshowCount).toBe(1);
    expect(d.pendingPaymentCount).toBe(1);
    expect(d.revenue).toBe(5000);
  });

  it('groups bookings into one daily doc per calendar day', async () => {
    await seedProvider();
    await seedBooking({
      datetime: new Date('2026-04-15T10:00:00Z'),
      clientEmail: 'a@x.com',
      price: 1000,
    });
    await seedBooking({
      datetime: new Date('2026-04-15T14:00:00Z'),
      clientEmail: 'b@x.com',
      price: 2000,
    });
    await seedBooking({
      datetime: new Date('2026-04-16T10:00:00Z'),
      clientEmail: 'a@x.com',
      price: 4000,
    });

    const result = await backfillProviderStats(db, PROVIDER_ID, true);

    expect(result.counts.daily).toBe(2); // 04-15 and 04-16
    expect(result.totalRevenue).toBe(7000);

    const apr15 = await db.doc(`providerStatsDaily/${PROVIDER_ID}_2026-04-15`).get();
    expect(apr15.data()?.revenue).toBe(3000);
    expect(apr15.data()?.bookingsCount).toBe(2);

    const apr16 = await db.doc(`providerStatsDaily/${PROVIDER_ID}_2026-04-16`).get();
    expect(apr16.data()?.revenue).toBe(4000);
  });

  it('produces a Firestore-compatible rolling doc (heatmap is flat 168-array)', async () => {
    // Regression test: heatmap90d used to be number[][] which
    // Firestore rejects ("Nested arrays are not allowed"). It must
    // be a single 168-element flat array.
    await seedProvider();
    // Spread bookings across multiple weekdays + hours to populate
    // various heatmap cells. Pad the hour to 2 digits — ISO-8601
    // strict parsers reject single-digit hours.
    for (let i = 0; i < 10; i++) {
      const hour = String((i + 8) % 24).padStart(2, '0');
      const day = String(10 + i).padStart(2, '0');
      await seedBooking({
        datetime: new Date(`2026-04-${day}T${hour}:00:00Z`),
        clientEmail: `c${i}@x.com`,
        price: 1000,
      });
    }

    // The .set() inside backfill is what would throw on nested
    // arrays. If this resolves, the doc is Firestore-compatible.
    const result = await backfillProviderStats(db, PROVIDER_ID, true);
    expect(result.performedWrites).toBe(true);

    const rolling = await db.doc(`providerStatsRolling/${PROVIDER_ID}`).get();
    expect(rolling.exists).toBe(true);

    const heatmap = rolling.data()!.heatmap90d;
    expect(Array.isArray(heatmap)).toBe(true);
    // 7 days × 24 hours = 168 cells.
    expect(heatmap.length).toBe(168);
    // Sanity — every cell is a number, not an array.
    for (const cell of heatmap) {
      expect(typeof cell).toBe('number');
    }
  });

  it('aggregates one client doc per distinct email, dropping anonymous bookings', async () => {
    await seedProvider();
    // Two bookings from the same email — one client.
    await seedBooking({ clientEmail: 'alice@x.com', price: 1000, status: 'confirmed' });
    await seedBooking({ clientEmail: 'alice@x.com', price: 2000, status: 'confirmed' });
    // One booking from another email — second client.
    await seedBooking({ clientEmail: 'bob@x.com', price: 3000, status: 'confirmed' });
    // Anonymous booking — no email, no clientId — should be skipped.
    await seedBooking({ clientEmail: '', clientId: null, price: 4000 });

    const result = await backfillProviderStats(db, PROVIDER_ID, true);

    expect(result.counts.clients).toBe(2);

    const alice = await db
      .doc(`providerClients/${PROVIDER_ID}_email:alice@x.com`)
      .get();
    expect(alice.data()?.bookingsCount).toBe(2);
    expect(alice.data()?.totalRevenue).toBe(3000);
    expect(alice.data()?.email).toBe('alice@x.com');

    const bob = await db.doc(`providerClients/${PROVIDER_ID}_email:bob@x.com`).get();
    expect(bob.data()?.bookingsCount).toBe(1);
    expect(bob.data()?.totalRevenue).toBe(3000);
  });

  it('preserves notes + preferences across a re-run of the backfill', async () => {
    await seedProvider();
    await seedBooking({ clientEmail: 'alice@x.com', price: 1000 });

    // First run — establishes the client doc.
    await backfillProviderStats(db, PROVIDER_ID, true);

    // Provider edits notes via /pro/clients (simulated direct write).
    await db
      .doc(`providerClients/${PROVIDER_ID}_email:alice@x.com`)
      .update({
        notes: 'Allergique aux noix',
        preferences: { preferred_member: 'alex' },
      });

    // Add another booking and re-run the backfill — counters update,
    // notes must NOT be wiped.
    await seedBooking({ clientEmail: 'alice@x.com', price: 2000 });
    await backfillProviderStats(db, PROVIDER_ID, true);

    const alice = await db
      .doc(`providerClients/${PROVIDER_ID}_email:alice@x.com`)
      .get();
    expect(alice.data()?.bookingsCount).toBe(2);
    expect(alice.data()?.totalRevenue).toBe(3000);
    // ★ The contract under test:
    expect(alice.data()?.notes).toBe('Allergique aux noix');
    expect(alice.data()?.preferences).toEqual({ preferred_member: 'alex' });
  });

  it('respects the `performWrites: false` dry-run mode', async () => {
    await seedProvider();
    await seedBooking({ clientEmail: 'a@x.com', price: 5000 });

    const result = await backfillProviderStats(db, PROVIDER_ID, false);

    expect(result.performedWrites).toBe(false);
    expect(result.counts.bookingsScanned).toBe(1);
    expect(result.totalRevenue).toBe(5000);

    // Nothing in Firestore.
    const dailySnap = await db.collection('providerStatsDaily').get();
    expect(dailySnap.size).toBe(0);
    const clientsSnap = await db.collection('providerClients').get();
    expect(clientsSnap.size).toBe(0);
  });

  it('marks first-time clients with the `new` tag', async () => {
    await seedProvider();
    // A booking from today (well within the 30-day "new" window).
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);
    await seedBooking({
      datetime: recent,
      createdAt: recent,
      clientEmail: 'fresh@x.com',
      price: 1000,
    });

    await backfillProviderStats(db, PROVIDER_ID, true);

    const fresh = await db
      .doc(`providerClients/${PROVIDER_ID}_email:fresh@x.com`)
      .get();
    expect(fresh.data()?.tags).toContain('new');
  });
});
