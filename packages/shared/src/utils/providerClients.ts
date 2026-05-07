/**
 * Pure aggregation logic for the per-provider client base.
 *
 * Same architectural pattern as providerStats.ts — these functions
 * take raw bookings and produce documents stored in
 * `providerClients/{providerId}_{clientKey}`. Reused by:
 *
 *   - the dev dry-run page (visual validation before any write)
 *   - the production backfill script (Admin SDK)
 *   - the booking write trigger (incremental updates)
 *   - the nightly cron (tag recomputation)
 *
 * No I/O — portable across browser, Cloud Functions and tests.
 *
 * Design notes:
 *
 *   - The output Map is keyed by `clientKey` (`email:foo@bar.com`
 *     or `id:userid`) — same key as `getClientKey()` in
 *     providerStats.ts. The Firestore doc id is
 *     `${providerId}_${clientKey}` so the path is deterministic
 *     and dedupable.
 *
 *   - Anonymous bookings (no email AND no clientId) are skipped.
 *     Without an identity we can't dedupe them, so they only
 *     contribute to providerStats counters, not to the CRM-style
 *     clients view.
 *
 *   - Marketing opt-in follows "latest booking wins" — if a client
 *     unchecks the box on a more recent booking they're opted out.
 *     This is RGPD-friendly (consent is revocable at any time).
 */

import type {
  Booking,
  ProviderClient,
  ProviderClientTag,
} from '../types';
import { getClientKey } from './providerStats';

// ────────────────────────────────────────────────────────────────
// Tag thresholds — surfaced as constants so the marketing/CRM
// segment definitions stay grep-able and reusable elsewhere
// (campaigns module, alerts, etc.).
// ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const CLIENT_TAG_THRESHOLDS = {
  /** Days within which `firstBookingAt` qualifies as a `new` client. */
  NEW_DAYS: 30,
  /** Min confirmed bookings + max days since last to be `regular`. */
  REGULAR_MIN_CONFIRMED: 3,
  REGULAR_MAX_INACTIVE_DAYS: 90,
  /** Either of these qualifies a client as `vip`. */
  VIP_MIN_CONFIRMED: 10,
  /** Cents — i.e. 500€. */
  VIP_MIN_REVENUE: 50_000,
  /** Inactive for at least this long → at risk. */
  AT_RISK_MIN_INACTIVE_DAYS: 60,
  AT_RISK_MAX_INACTIVE_DAYS: 180,
  /** Inactive for longer than this → lost. */
  LOST_MIN_INACTIVE_DAYS: 180,
  /** No-show rate above this on at least N bookings → noshow_prone. */
  NOSHOW_PRONE_MIN_BOOKINGS: 3,
  NOSHOW_PRONE_MIN_RATE: 0.2,
} as const;

// ────────────────────────────────────────────────────────────────
// Tag computation
// ────────────────────────────────────────────────────────────────

/**
 * Pure, deterministic tag derivation. Takes a fully-aggregated
 * client doc + a "now" reference (injected for testability) and
 * returns the tag array. Order is stable (matches the `ProviderClientTag`
 * union order) so equality comparisons in the trigger are cheap.
 *
 * NB: tags are NOT mutually exclusive. A `vip` who hasn't booked
 * in 4 months is `vip + at_risk` — which is exactly the segment
 * a campaign would target.
 */
export function computeClientTags(
  client: Pick<
    ProviderClient,
    | 'firstBookingAt'
    | 'lastBookingAt'
    | 'bookingsCount'
    | 'confirmedCount'
    | 'noshowCount'
    | 'totalRevenue'
  >,
  now: Date,
): ProviderClientTag[] {
  const tags: ProviderClientTag[] = [];
  const T = CLIENT_TAG_THRESHOLDS;

  const daysSinceFirst =
    (now.getTime() - client.firstBookingAt.getTime()) / MS_PER_DAY;
  const daysSinceLast =
    (now.getTime() - client.lastBookingAt.getTime()) / MS_PER_DAY;

  if (daysSinceFirst <= T.NEW_DAYS) {
    tags.push('new');
  }

  if (
    client.confirmedCount >= T.REGULAR_MIN_CONFIRMED &&
    daysSinceLast <= T.REGULAR_MAX_INACTIVE_DAYS
  ) {
    tags.push('regular');
  }

  if (
    client.confirmedCount >= T.VIP_MIN_CONFIRMED ||
    client.totalRevenue >= T.VIP_MIN_REVENUE
  ) {
    tags.push('vip');
  }

  if (
    daysSinceLast >= T.AT_RISK_MIN_INACTIVE_DAYS &&
    daysSinceLast < T.AT_RISK_MAX_INACTIVE_DAYS
  ) {
    tags.push('at_risk');
  }

  if (daysSinceLast >= T.LOST_MIN_INACTIVE_DAYS) {
    tags.push('lost');
  }

  if (
    client.bookingsCount >= T.NOSHOW_PRONE_MIN_BOOKINGS &&
    client.noshowCount / client.bookingsCount > T.NOSHOW_PRONE_MIN_RATE
  ) {
    tags.push('noshow_prone');
  }

  return tags;
}

// ────────────────────────────────────────────────────────────────
// Aggregation
// ────────────────────────────────────────────────────────────────

export interface AggregateClientsOptions {
  providerId: string;
  /**
   * Optional: identity enrichment for registered Opatam users
   * (clientId-keyed lookup). When supplied the aggregation will
   * pull `displayName`/`photoURL` from this map rather than the
   * potentially stale `clientInfo.name` denormalised on the
   * booking. Pass `{}` to skip enrichment.
   */
  registeredUsers?: Record<
    string,
    { displayName: string; photoURL: string | null; phone: string | null }
  >;
}

/**
 * Walk a flat bookings array and produce one ProviderClient per
 * distinct client identity. Order doesn't matter on input (the
 * function sorts by `createdAt` so "latest booking wins" for the
 * denormalised name/email/marketingOptIn fields).
 *
 * Anonymous bookings (no email AND no clientId) are skipped —
 * `getClientKey` returns the synthetic `'anonymous'` for them and
 * we explicitly drop those.
 *
 * The returned Map keys match the Firestore doc id suffix
 * (i.e. the clientKey). Caller writes to
 * `providerClients/{providerId}_{key}`.
 */
export function aggregateBookingsToClients(
  bookings: Booking[],
  opts: AggregateClientsOptions,
  now: Date = new Date(),
): Map<string, ProviderClient> {
  // Sort by createdAt ascending so "latest booking wins" works by
  // letting the loop overwrite identity fields with each newer
  // booking. Tied timestamps fall back to datetime ordering.
  const sorted = [...bookings].sort((a, b) => {
    const c = a.createdAt.getTime() - b.createdAt.getTime();
    return c !== 0 ? c : a.datetime.getTime() - b.datetime.getTime();
  });

  const clients = new Map<string, ProviderClient>();

  for (const booking of sorted) {
    const key = getClientKey(booking);
    if (key === 'anonymous') continue;

    let client = clients.get(key);
    if (!client) {
      client = emptyClient(opts.providerId, key, booking);
      clients.set(key, client);
    }

    // ── Identity (latest booking wins) ───────────────────────
    // The latest booking carries the most up-to-date contact info
    // (a client may rebook with a corrected phone, etc.).
    client.name = booking.clientInfo?.name ?? client.name;
    client.email = booking.clientInfo?.email?.toLowerCase().trim() ?? client.email;
    client.phone = booking.clientInfo?.phone ?? client.phone;

    if (booking.clientId) {
      client.clientId = booking.clientId;
      // If we have a registeredUsers map, prefer its values for
      // name/photo since they're the canonical source.
      const registered = opts.registeredUsers?.[booking.clientId];
      if (registered) {
        client.name = registered.displayName || client.name;
        client.photoURL = registered.photoURL ?? client.photoURL;
        client.phone = registered.phone ?? client.phone;
      }
    }

    // ── Counters ─────────────────────────────────────────────
    client.bookingsCount += 1;
    switch (booking.status) {
      case 'confirmed':
        client.confirmedCount += 1;
        client.totalRevenue += booking.price ?? 0;
        break;
      case 'cancelled':
        client.cancelledCount += 1;
        break;
      case 'noshow':
        client.noshowCount += 1;
        break;
      // pending / pending_payment don't impact the dashboard
      // counters here — they're transient states.
    }

    // ── Time bookends ────────────────────────────────────────
    if (booking.datetime < client.firstBookingAt) {
      client.firstBookingAt = booking.datetime;
    }
    if (booking.datetime > client.lastBookingAt) {
      client.lastBookingAt = booking.datetime;
    }

    // ── Marketing opt-in: latest booking wins ────────────────
    // We're walking in chronological order, so the last write
    // here is from the latest booking — no extra ordering work.
    const optIn = booking.clientInfo?.marketingOptIn === true;
    if (optIn && !client.marketingOptIn) {
      client.marketingOptInAt = booking.createdAt;
    } else if (!optIn && client.marketingOptIn) {
      client.marketingOptOutAt = booking.createdAt;
    }
    client.marketingOptIn = optIn;

    client.updatedAt = booking.createdAt > client.updatedAt
      ? booking.createdAt
      : client.updatedAt;
  }

  // ── Recompute tags after all aggregation is done ─────────────
  for (const client of clients.values()) {
    client.tags = computeClientTags(client, now);
  }

  return clients;
}

function emptyClient(
  providerId: string,
  clientKey: string,
  firstBooking: Booking,
): ProviderClient {
  return {
    providerId,
    clientKey,
    email: null,
    phone: null,
    name: '',
    clientId: null,
    photoURL: null,
    bookingsCount: 0,
    confirmedCount: 0,
    cancelledCount: 0,
    noshowCount: 0,
    totalRevenue: 0,
    // Initialise to extremes so the first booking always replaces
    // them. Using `firstBooking.datetime` here as a sane default
    // keeps the doc valid even if the loop short-circuits.
    firstBookingAt: firstBooking.datetime,
    lastBookingAt: firstBooking.datetime,
    tags: [],
    notes: null,
    preferences: null,
    marketingOptIn: false,
    marketingOptInAt: null,
    marketingOptOutAt: null,
    createdAt: firstBooking.createdAt,
    updatedAt: firstBooking.createdAt,
  };
}
