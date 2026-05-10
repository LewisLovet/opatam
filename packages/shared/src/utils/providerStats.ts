/**
 * Pure aggregation logic for provider business stats.
 *
 * These functions take raw bookings and produce the documents stored
 * in `providerStatsDaily`, `providerStatsMonthly` and
 * `providerStatsRolling`. The same code is reused by:
 *
 *  - the dev dry-run page (`/dev/tools/stats-backfill`)
 *  - the production backfill script
 *  - the Cloud Function trigger on bookings/{id}
 *  - the nightly cron (consolidation + rolling snapshots)
 *
 * No I/O, no Firestore imports — keeps it portable across browser,
 * Cloud Functions and the test suite. Determinism is the contract:
 * the same input bookings always produce the same output documents.
 *
 * Revenue rule (validated with the team):
 *   `status === 'confirmed'` AND `datetime < now`.
 * The "datetime in the past" half is applied at READ time — the
 * daily doc for "today" legitimately contains bookings for the rest
 * of the day, and the UI subtracts those at query time. Daily docs
 * for yesterday and earlier are 100% past so the rule simplifies
 * there.
 */

import { DEFAULT_TIMEZONE } from '../constants';
import type {
  ActivityCategory,
  BlockedSlot,
  Booking,
  BookingStatus,
  ProviderClient,
  ProviderStatsActivityBreakdown,
  ProviderStatsDaily,
  ProviderStatsMemberBreakdown,
  ProviderStatsMonthly,
  ProviderStatsRolling,
  ProviderStatsServiceBreakdown,
} from '../types';
import { aggregateBookingsToClients } from './providerClients';

// ────────────────────────────────────────────────────────────────
// Date keys (provider-local timezone)
// ────────────────────────────────────────────────────────────────

/**
 * Format a Date as `YYYY-MM-DD` in a given IANA timezone. We default
 * to Europe/Paris because that's where the vast majority of our
 * providers operate; can be overridden once Provider gets a
 * timezone field.
 */
export function dateKeyInTz(d: Date, timezone: string = DEFAULT_TIMEZONE): string {
  // `en-CA` happens to format YYYY-MM-DD natively — saves manual padding.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Same as above but returns `YYYY-MM`. */
export function monthKeyInTz(d: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return dateKeyInTz(d, timezone).slice(0, 7);
}

/**
 * Hour of day (0-23) for a Date, evaluated in the given timezone.
 * Used for the heatmap and the per-day `hourCounts` array.
 */
export function hourInTz(d: Date, timezone: string = DEFAULT_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === 'hour');
  // Edge case: en-GB returns "24" for midnight on some runtimes.
  const hour = hourPart ? parseInt(hourPart.value, 10) : 0;
  return hour === 24 ? 0 : hour;
}

/** Day of week (0 = Sunday … 6 = Saturday) in the given timezone. */
export function dayOfWeekInTz(d: Date, timezone: string = DEFAULT_TIMEZONE): number {
  // Intl gives us an English weekday short name; map back to 0-6.
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[weekday] ?? 0;
}

// ────────────────────────────────────────────────────────────────
// Client identity
// ────────────────────────────────────────────────────────────────

/**
 * Normalize a booking's client identity into a stable string used to
 * dedupe across the doc. Email wins (catches anonymous bookings
 * that share an email), then `clientId`, then a synthetic anonymous
 * marker. Lowercased + trimmed so "Foo@x.com  " and "foo@x.com"
 * collide as expected.
 *
 * NB: at this stage we store the normalized email itself rather
 * than a sha256 hash. The agg docs sit behind admin-only Firestore
 * rules so this is acceptable; we can flip to hashing later
 * (back-compatible — the field is just an opaque string) if we
 * decide we want zero PII at the agg layer.
 */
export function getClientKey(booking: Pick<Booking, 'clientId' | 'clientInfo'>): string {
  const email = booking.clientInfo?.email?.toLowerCase().trim();
  if (email) return `email:${email}`;
  if (booking.clientId) return `id:${booking.clientId}`;
  return 'anonymous';
}

// ────────────────────────────────────────────────────────────────
// Empty docs (factories)
// ────────────────────────────────────────────────────────────────

function emptyDaily(providerId: string, date: string): ProviderStatsDaily {
  return {
    providerId,
    date,
    bookingsCount: 0,
    confirmedCount: 0,
    pendingCount: 0,
    pendingPaymentCount: 0,
    cancelledCount: 0,
    noshowCount: 0,
    revenue: 0,
    activityRevenue: 0,
    activityCount: 0,
    activitiesByCategory: [],
    clientHashes: [],
    newClientHashes: [],
    services: [],
    members: [],
    hourCounts: new Array(24).fill(0) as number[],
    updatedAt: new Date(),
  };
}

function emptyMonthly(providerId: string, month: string): ProviderStatsMonthly {
  return {
    providerId,
    month,
    bookingsCount: 0,
    confirmedCount: 0,
    pendingCount: 0,
    pendingPaymentCount: 0,
    cancelledCount: 0,
    noshowCount: 0,
    revenue: 0,
    activityRevenue: 0,
    activityCount: 0,
    activitiesByCategory: [],
    clientHashes: [],
    newClientHashes: [],
    services: [],
    members: [],
    hourCounts: new Array(24).fill(0) as number[],
    updatedAt: new Date(),
  };
}

/**
 * Flat 7*24 = 168-element array for the day-of-week × hour heatmap.
 * Indexed by `dow * 24 + hour`. Stored flat because Firestore
 * rejects nested arrays.
 */
function emptyHeatmap(): number[] {
  return new Array(7 * 24).fill(0) as number[];
}

// ────────────────────────────────────────────────────────────────
// Per-status counter
// ────────────────────────────────────────────────────────────────

/** Field name on a daily/monthly doc that counts bookings of a status. */
const STATUS_FIELD: Record<BookingStatus, keyof ProviderStatsDaily> = {
  confirmed: 'confirmedCount',
  pending: 'pendingCount',
  pending_payment: 'pendingPaymentCount',
  cancelled: 'cancelledCount',
  noshow: 'noshowCount',
};

// ────────────────────────────────────────────────────────────────
// Daily aggregation — the main entry point
// ────────────────────────────────────────────────────────────────

export interface AggregateOptions {
  providerId: string;
  /** Provider's display name — used for the synthetic "self" member entry. */
  providerName: string;
  /** Map of memberId → { name } so we denormalize current names if a member was renamed since the booking was created. */
  membersById?: Record<string, { name: string }>;
  /** Defaults to Europe/Paris. */
  timezone?: string;
}

/**
 * Walk a flat list of bookings and produce one ProviderStatsDaily per
 * (provider, calendar day) that has at least one booking. Order of
 * the input doesn't matter, but for `newClientHashes` to be correct
 * the function sorts internally by datetime ascending.
 *
 * The output Map's keys are YYYY-MM-DD strings.
 */
export function aggregateBookingsToDaily(
  bookings: Booking[],
  opts: AggregateOptions,
): Map<string, ProviderStatsDaily> {
  const tz = opts.timezone ?? DEFAULT_TIMEZONE;
  const dailies = new Map<string, ProviderStatsDaily>();
  // Walk chronologically so "first booking ever" is correctly flagged.
  const sorted = [...bookings].sort(
    (a, b) => a.datetime.getTime() - b.datetime.getTime(),
  );
  const seenClients = new Set<string>();

  for (const booking of sorted) {
    const date = dateKeyInTz(booking.datetime, tz);
    let daily = dailies.get(date);
    if (!daily) {
      daily = emptyDaily(opts.providerId, date);
      dailies.set(date, daily);
    }

    daily.bookingsCount += 1;
    const statusField = STATUS_FIELD[booking.status];
    if (statusField) {
      (daily[statusField] as number) += 1;
    }

    // Revenue contribution — confirmed only, regardless of past/future.
    // The "past only" filter is applied by the reading code (see file
    // header). Daily docs are summed over a window and we trust that
    // dates < today are 100% past at read time.
    if (booking.status === 'confirmed') {
      daily.revenue += booking.price ?? 0;
    }

    // Hour-of-day distribution (in provider tz).
    const hour = hourInTz(booking.datetime, tz);
    daily.hourCounts[hour] = (daily.hourCounts[hour] ?? 0) + 1;

    // Client identity tracking.
    const clientKey = getClientKey(booking);
    if (clientKey !== 'anonymous') {
      if (!daily.clientHashes.includes(clientKey)) {
        daily.clientHashes.push(clientKey);
      }
      if (!seenClients.has(clientKey)) {
        seenClients.add(clientKey);
        if (!daily.newClientHashes.includes(clientKey)) {
          daily.newClientHashes.push(clientKey);
        }
      }
    }

    // Per-service breakdown.
    upsertServiceBreakdown(daily.services, booking);

    // Per-member breakdown — null memberId is stored as "self".
    upsertMemberBreakdown(daily.members, booking, opts);
  }

  return dailies;
}

/**
 * Fold paid activities (BlockedSlot entries with `category` set AND
 * `amount > 0`) into the daily docs as the "Autres revenus" track.
 *
 * Mutates the input map in place: existing daily docs gain
 * `activityRevenue` / `activityCount` / `activitiesByCategory`
 * contributions, and a fresh empty daily is created on dates that
 * had activities but no bookings (otherwise the activity revenue
 * would be lost on bookless days).
 *
 * Activities WITHOUT a `category` (raw blocked periods like vacations)
 * are ignored — they're not "earnings". Activities with `amount` ≤ 0
 * or null are ignored too — those are unpaid personal events
 * (sport, perso) and shouldn't bump the revenue track.
 *
 * Future-dated activities are kept on principle (the pro entered
 * a planned paid workshop): the read layer applies the same
 * "past only" rule to activityRevenue as it does to revenue, so
 * the future never leaks into "today's CA". Daily docs for
 * yesterday and earlier are 100% past so the read layer doesn't
 * filter there.
 */
export function mergeActivitiesIntoDailies(
  activities: BlockedSlot[],
  dailies: Map<string, ProviderStatsDaily>,
  opts: { providerId: string; timezone?: string },
): Map<string, ProviderStatsDaily> {
  const tz = opts.timezone ?? DEFAULT_TIMEZONE;

  for (const slot of activities) {
    if (!slot.category) continue;
    const amount = slot.amount ?? 0;
    if (amount <= 0) continue;

    const date = dateKeyInTz(slot.startDate, tz);
    let daily = dailies.get(date);
    if (!daily) {
      daily = emptyDaily(opts.providerId, date);
      dailies.set(date, daily);
    }

    daily.activityRevenue += amount;
    daily.activityCount += 1;
    upsertActivityBreakdown(daily.activitiesByCategory, slot.category, amount);
  }

  return dailies;
}

function upsertActivityBreakdown(
  list: ProviderStatsActivityBreakdown[],
  category: ActivityCategory,
  amount: number,
): void {
  let entry = list.find((e) => e.category === category);
  if (!entry) {
    entry = { category, count: 0, revenue: 0 };
    list.push(entry);
  }
  entry.count += 1;
  entry.revenue += amount;
}

function upsertServiceBreakdown(
  services: ProviderStatsServiceBreakdown[],
  booking: Booking,
) {
  let entry = services.find((s) => s.serviceId === booking.serviceId);
  if (!entry) {
    entry = {
      serviceId: booking.serviceId,
      serviceName: booking.serviceName,
      bookingsCount: 0,
      confirmedCount: 0,
      revenue: 0,
    };
    services.push(entry);
  }
  entry.bookingsCount += 1;
  if (booking.status === 'confirmed') {
    entry.confirmedCount += 1;
    entry.revenue += booking.price ?? 0;
  }
}

function upsertMemberBreakdown(
  members: ProviderStatsMemberBreakdown[],
  booking: Booking,
  opts: AggregateOptions,
) {
  const memberId = booking.memberId;
  let entry = members.find((m) => m.memberId === memberId);
  if (!entry) {
    let memberName: string;
    if (memberId === null) {
      memberName = opts.providerName;
    } else {
      memberName =
        opts.membersById?.[memberId]?.name ??
        booking.memberName ??
        'Membre supprimé';
    }
    entry = {
      memberId,
      memberName,
      bookingsCount: 0,
      confirmedCount: 0,
      revenue: 0,
    };
    members.push(entry);
  }
  entry.bookingsCount += 1;
  if (booking.status === 'confirmed') {
    entry.confirmedCount += 1;
    entry.revenue += booking.price ?? 0;
  }
}

// ────────────────────────────────────────────────────────────────
// Monthly aggregation — roll up daily docs
// ────────────────────────────────────────────────────────────────

/**
 * Sum a set of daily docs into one monthly doc per calendar month.
 * Pure function — same docs in, same docs out, no global state.
 */
export function aggregateDailiesToMonthly(
  dailies: ProviderStatsDaily[],
  providerId: string,
): Map<string, ProviderStatsMonthly> {
  const monthlies = new Map<string, ProviderStatsMonthly>();

  for (const daily of dailies) {
    const month = daily.date.slice(0, 7); // YYYY-MM
    let monthly = monthlies.get(month);
    if (!monthly) {
      monthly = emptyMonthly(providerId, month);
      monthlies.set(month, monthly);
    }

    monthly.bookingsCount += daily.bookingsCount;
    monthly.confirmedCount += daily.confirmedCount;
    monthly.pendingCount += daily.pendingCount;
    monthly.pendingPaymentCount += daily.pendingPaymentCount;
    monthly.cancelledCount += daily.cancelledCount;
    monthly.noshowCount += daily.noshowCount;
    monthly.revenue += daily.revenue;

    // "Autres revenus" track — defaults guard against legacy daily
    // docs written before activityRevenue was added to the schema.
    monthly.activityRevenue += daily.activityRevenue ?? 0;
    monthly.activityCount += daily.activityCount ?? 0;
    for (const c of daily.activitiesByCategory ?? []) {
      let entry = monthly.activitiesByCategory.find((x) => x.category === c.category);
      if (!entry) {
        entry = { category: c.category, count: 0, revenue: 0 };
        monthly.activitiesByCategory.push(entry);
      }
      entry.count += c.count;
      entry.revenue += c.revenue;
    }

    // Union client hashes across the month.
    for (const h of daily.clientHashes) {
      if (!monthly.clientHashes.includes(h)) monthly.clientHashes.push(h);
    }
    for (const h of daily.newClientHashes) {
      if (!monthly.newClientHashes.includes(h)) monthly.newClientHashes.push(h);
    }

    // Sum hour counts.
    for (let h = 0; h < 24; h++) {
      monthly.hourCounts[h] += daily.hourCounts[h] ?? 0;
    }

    // Merge per-service.
    for (const s of daily.services) {
      let entry = monthly.services.find((x) => x.serviceId === s.serviceId);
      if (!entry) {
        entry = {
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          bookingsCount: 0,
          confirmedCount: 0,
          revenue: 0,
        };
        monthly.services.push(entry);
      }
      entry.bookingsCount += s.bookingsCount;
      entry.confirmedCount += s.confirmedCount;
      entry.revenue += s.revenue;
    }

    // Merge per-member.
    for (const m of daily.members) {
      let entry = monthly.members.find((x) => x.memberId === m.memberId);
      if (!entry) {
        entry = {
          memberId: m.memberId,
          memberName: m.memberName,
          bookingsCount: 0,
          confirmedCount: 0,
          revenue: 0,
        };
        monthly.members.push(entry);
      }
      entry.bookingsCount += m.bookingsCount;
      entry.confirmedCount += m.confirmedCount;
      entry.revenue += m.revenue;
    }
  }

  return monthlies;
}

// ────────────────────────────────────────────────────────────────
// Rolling snapshots — top-K + heatmap
// ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface ClientAggregate {
  clientHash: string;
  bookingsCount: number;
  revenue: number;
}

/**
 * Compute the rolling top-K + heatmap snapshot doc from a set of
 * daily docs and the original bookings (we need the bookings for
 * per-client revenue since dailies only carry hashes, not amounts).
 *
 * `now` is injected so tests are deterministic.
 */
export function aggregateRolling(
  dailies: ProviderStatsDaily[],
  bookings: Booking[],
  providerId: string,
  now: Date,
  timezone: string = DEFAULT_TIMEZONE,
): ProviderStatsRolling {
  // Window boundaries (inclusive of today).
  const cutoff30d = new Date(now.getTime() - 30 * MS_PER_DAY);
  const cutoff90d = new Date(now.getTime() - 90 * MS_PER_DAY);

  const dailiesAfter = (cutoff: Date) =>
    dailies.filter((d) => d.date >= dateKeyInTz(cutoff, timezone));

  // ── Top services per window ────────────────────────────────────
  const topServices30d = topServicesFromDailies(dailiesAfter(cutoff30d));
  const topServices90d = topServicesFromDailies(dailiesAfter(cutoff90d));
  const topServicesAllTime = topServicesFromDailies(dailies);

  // ── Top clients per window — needs raw bookings for revenue ─────
  const topClients30d = topClientsFromBookings(bookings, cutoff30d);
  const topClients90d = topClientsFromBookings(bookings, cutoff90d);
  const topClientsAllTime = topClientsFromBookings(bookings, null);

  // ── Heatmap day-of-week × hour-of-day, last 90 days ─────────────
  // Flat 168-element array (dow * 24 + hour) — Firestore rejects
  // nested arrays so we cannot use number[][].
  const heatmap90d = emptyHeatmap();
  for (const booking of bookings) {
    if (booking.datetime < cutoff90d) continue;
    const dow = dayOfWeekInTz(booking.datetime, timezone);
    const hour = hourInTz(booking.datetime, timezone);
    heatmap90d[dow * 24 + hour] += 1;
  }

  return {
    providerId,
    topServices30d,
    topServices90d,
    topServicesAllTime,
    topClients30d,
    topClients90d,
    topClientsAllTime,
    heatmap90d,
    updatedAt: new Date(),
  };
}

function topServicesFromDailies(
  dailies: ProviderStatsDaily[],
  topK = 10,
): ProviderStatsServiceBreakdown[] {
  const acc = new Map<string, ProviderStatsServiceBreakdown>();
  for (const daily of dailies) {
    for (const s of daily.services) {
      let entry = acc.get(s.serviceId);
      if (!entry) {
        entry = {
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          bookingsCount: 0,
          confirmedCount: 0,
          revenue: 0,
        };
        acc.set(s.serviceId, entry);
      }
      entry.bookingsCount += s.bookingsCount;
      entry.confirmedCount += s.confirmedCount;
      entry.revenue += s.revenue;
    }
  }
  return [...acc.values()]
    .sort((a, b) => b.revenue - a.revenue || b.bookingsCount - a.bookingsCount)
    .slice(0, topK);
}

function topClientsFromBookings(
  bookings: Booking[],
  cutoff: Date | null,
  topK = 10,
): ClientAggregate[] {
  const acc = new Map<string, ClientAggregate>();
  for (const booking of bookings) {
    if (cutoff && booking.datetime < cutoff) continue;
    const key = getClientKey(booking);
    if (key === 'anonymous') continue;
    let entry = acc.get(key);
    if (!entry) {
      entry = { clientHash: key, bookingsCount: 0, revenue: 0 };
      acc.set(key, entry);
    }
    entry.bookingsCount += 1;
    if (booking.status === 'confirmed') {
      entry.revenue += booking.price ?? 0;
    }
  }
  return [...acc.values()]
    .sort((a, b) => b.revenue - a.revenue || b.bookingsCount - a.bookingsCount)
    .slice(0, topK);
}

// ────────────────────────────────────────────────────────────────
// Convenience: full pipeline (daily + monthly + rolling) in one call
// ────────────────────────────────────────────────────────────────

export interface FullAggregateResult {
  daily: ProviderStatsDaily[];
  monthly: ProviderStatsMonthly[];
  rolling: ProviderStatsRolling;
  clients: ProviderClient[];
}

/**
 * Run the entire pipeline against a flat list of bookings. Used by
 * the dry-run dev page and the backfill script (which both want
 * the complete picture in one go). The Cloud Function trigger
 * doesn't use this — it computes incremental diffs.
 *
 * Optional `registeredUsers` map enriches the clients output with
 * canonical name/photo/phone for registered Opatam users (preferred
 * over the denormalised `clientInfo` snapshot on the booking).
 */
export function aggregateFullPipeline(
  bookings: Booking[],
  opts: AggregateOptions & {
    registeredUsers?: Record<
      string,
      { displayName: string; photoURL: string | null; phone: string | null }
    >;
    /**
     * Paid activities (BlockedSlot with category + amount). Optional
     * for backward-compat with callers that don't (yet) source them;
     * when omitted the activity-revenue fields stay at 0 across all
     * daily/monthly docs. Pass an empty array to be explicit about
     * "no paid activities" vs. "didn't fetch".
     */
    activities?: BlockedSlot[];
  },
  now: Date = new Date(),
): FullAggregateResult {
  const dailyMap = aggregateBookingsToDaily(bookings, opts);
  if (opts.activities && opts.activities.length > 0) {
    mergeActivitiesIntoDailies(opts.activities, dailyMap, {
      providerId: opts.providerId,
      timezone: opts.timezone,
    });
  }
  const dailyArr = [...dailyMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const monthlyMap = aggregateDailiesToMonthly(dailyArr, opts.providerId);
  const monthlyArr = [...monthlyMap.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const rolling = aggregateRolling(
    dailyArr,
    bookings,
    opts.providerId,
    now,
    opts.timezone,
  );
  const clientsMap = aggregateBookingsToClients(
    bookings,
    {
      providerId: opts.providerId,
      registeredUsers: opts.registeredUsers,
    },
    now,
  );
  const clientsArr = [...clientsMap.values()].sort(
    (a, b) => b.totalRevenue - a.totalRevenue,
  );
  return {
    daily: dailyArr,
    monthly: monthlyArr,
    rolling,
    clients: clientsArr,
  };
}
