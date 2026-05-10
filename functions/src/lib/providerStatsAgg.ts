/**
 * Provider stats aggregation — Cloud Functions copy.
 *
 * ⚠️ DUPLICATE — keep in sync with
 * `packages/shared/src/utils/providerStats.ts` and
 * `packages/shared/src/utils/providerClients.ts`.
 *
 * Why duplicated: `functions/` builds with raw `tsc` and `module:
 * commonjs`, with `rootDir: ./src`. It cannot import .ts files
 * from outside src/ without breaking the emit. The shared package
 * isn't pre-built into dist/, and project references would require
 * a build cascade we're not ready to introduce. Until that lands,
 * we duplicate the pure aggregation logic verbatim and keep the
 * types in sync manually. This matches the pattern already in use
 * for `resendService.ts` (note: "Keep in sync with @booking-app/shared").
 *
 * The logic must be byte-for-byte equivalent so the dry-run dev
 * page (which uses the shared version) and the prod backfill /
 * trigger (which use this file) produce identical aggregates from
 * identical input.
 */

import { Timestamp } from 'firebase-admin/firestore';

const DEFAULT_TIMEZONE = 'Europe/Paris';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ────────────────────────────────────────────────────────────────
// Local types (shape-compatible with @booking-app/shared)
// ────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending_payment'
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'noshow';

export interface ClientInfoLike {
  name: string;
  email: string;
  phone?: string;
  marketingOptIn?: boolean;
}

/**
 * Minimal booking shape used by the aggregation. Real bookings have
 * many more fields but the aggregator only touches these.
 */
export interface BookingLike {
  providerId: string;
  clientId: string | null;
  memberId: string | null;
  providerName?: string;
  memberName?: string | null;
  serviceId: string;
  serviceName: string;
  price: number;
  status: BookingStatus;
  datetime: Date;
  clientInfo: ClientInfoLike;
  createdAt: Date;
}

export interface ProviderStatsServiceBreakdown {
  serviceId: string;
  serviceName: string;
  bookingsCount: number;
  confirmedCount: number;
  revenue: number;
}

export interface ProviderStatsMemberBreakdown {
  memberId: string | null;
  memberName: string;
  bookingsCount: number;
  confirmedCount: number;
  revenue: number;
}

/** Mirror of ActivityCategory in @booking-app/shared. Keep in sync. */
export type ActivityCategory =
  | 'sport'
  | 'meeting'
  | 'personal'
  | 'admin'
  | 'travel'
  | 'imprevu'
  | 'other';

/** Per-category breakdown of paid-activity revenue ("Autres revenus"). */
export interface ProviderStatsActivityBreakdown {
  category: ActivityCategory;
  count: number;
  revenue: number;
}

/**
 * Minimal BlockedSlot shape used by the activity aggregator. The
 * trigger maps the Firestore doc into this shape (Timestamp →
 * Date).
 */
export interface BlockedSlotLike {
  category?: ActivityCategory | null;
  amount?: number | null;
  startDate: Date;
}

export interface ProviderStatsDaily {
  providerId: string;
  date: string;
  bookingsCount: number;
  confirmedCount: number;
  pendingCount: number;
  pendingPaymentCount: number;
  cancelledCount: number;
  noshowCount: number;
  revenue: number;
  /** Paid-activity revenue track. See @booking-app/shared for full
   *  semantics. Defaults to 0 — backward-compatible with older docs. */
  activityRevenue: number;
  activityCount: number;
  activitiesByCategory: ProviderStatsActivityBreakdown[];
  clientHashes: string[];
  newClientHashes: string[];
  services: ProviderStatsServiceBreakdown[];
  members: ProviderStatsMemberBreakdown[];
  hourCounts: number[];
  updatedAt: Date;
}

export interface ProviderStatsMonthly {
  providerId: string;
  month: string;
  bookingsCount: number;
  confirmedCount: number;
  pendingCount: number;
  pendingPaymentCount: number;
  cancelledCount: number;
  noshowCount: number;
  revenue: number;
  activityRevenue: number;
  activityCount: number;
  activitiesByCategory: ProviderStatsActivityBreakdown[];
  clientHashes: string[];
  newClientHashes: string[];
  services: ProviderStatsServiceBreakdown[];
  members: ProviderStatsMemberBreakdown[];
  hourCounts: number[];
  updatedAt: Date;
}

export interface ProviderStatsRolling {
  providerId: string;
  topServices30d: ProviderStatsServiceBreakdown[];
  topServices90d: ProviderStatsServiceBreakdown[];
  topServicesAllTime: ProviderStatsServiceBreakdown[];
  topClients30d: { clientHash: string; bookingsCount: number; revenue: number }[];
  topClients90d: { clientHash: string; bookingsCount: number; revenue: number }[];
  topClientsAllTime: { clientHash: string; bookingsCount: number; revenue: number }[];
  /** Flat 168-element array (dow*24 + hour). Firestore rejects nested arrays. */
  heatmap90d: number[];
  updatedAt: Date;
}

export type ProviderClientTag =
  | 'new'
  | 'regular'
  | 'vip'
  | 'at_risk'
  | 'lost'
  | 'noshow_prone';

export interface ProviderClient {
  providerId: string;
  clientKey: string;
  email: string | null;
  phone: string | null;
  name: string;
  clientId: string | null;
  photoURL: string | null;
  bookingsCount: number;
  confirmedCount: number;
  cancelledCount: number;
  noshowCount: number;
  totalRevenue: number;
  firstBookingAt: Date;
  lastBookingAt: Date;
  tags: ProviderClientTag[];
  notes: string | null;
  preferences: Record<string, string> | null;
  marketingOptIn: boolean;
  marketingOptInAt: Date | null;
  marketingOptOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

export function dateKeyInTz(d: Date, tz: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function monthKeyInTz(d: Date, tz: string = DEFAULT_TIMEZONE): string {
  return dateKeyInTz(d, tz).slice(0, 7);
}

export function hourInTz(d: Date, tz: string = DEFAULT_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === 'hour');
  const hour = hourPart ? parseInt(hourPart.value, 10) : 0;
  return hour === 24 ? 0 : hour;
}

export function dayOfWeekInTz(d: Date, tz: string = DEFAULT_TIMEZONE): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

/** `email:foo@bar.com` / `id:user123` / `'anonymous'` */
export function getClientKey(b: Pick<BookingLike, 'clientId' | 'clientInfo'>): string {
  const email = b.clientInfo?.email?.toLowerCase().trim();
  if (email) return `email:${email}`;
  if (b.clientId) return `id:${b.clientId}`;
  return 'anonymous';
}

/**
 * Convert Firestore document data to the BookingLike shape. Firestore
 * stores Dates as Timestamps; we hydrate them back so the aggregation
 * can use Date math.
 */
export function bookingFromFirestore(data: Record<string, unknown>): BookingLike {
  const ts = (v: unknown): Date =>
    v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : new Date(v as string);
  return {
    providerId: data.providerId as string,
    clientId: (data.clientId as string | null) ?? null,
    memberId: (data.memberId as string | null) ?? null,
    providerName: data.providerName as string | undefined,
    memberName: (data.memberName as string | null) ?? null,
    serviceId: data.serviceId as string,
    serviceName: data.serviceName as string,
    price: (data.price as number) ?? 0,
    status: data.status as BookingStatus,
    datetime: ts(data.datetime),
    clientInfo: (data.clientInfo as ClientInfoLike) ?? {
      name: '',
      email: '',
    },
    createdAt: ts(data.createdAt),
  };
}

const STATUS_FIELD: Record<BookingStatus, keyof ProviderStatsDaily> = {
  confirmed: 'confirmedCount',
  pending: 'pendingCount',
  pending_payment: 'pendingPaymentCount',
  cancelled: 'cancelledCount',
  noshow: 'noshowCount',
};

// ────────────────────────────────────────────────────────────────
// Empty-doc factories
// ────────────────────────────────────────────────────────────────

function emptyDaily(providerId: string, date: string): ProviderStatsDaily {
  return {
    providerId, date,
    bookingsCount: 0, confirmedCount: 0, pendingCount: 0, pendingPaymentCount: 0,
    cancelledCount: 0, noshowCount: 0, revenue: 0,
    activityRevenue: 0, activityCount: 0, activitiesByCategory: [],
    clientHashes: [], newClientHashes: [], services: [], members: [],
    hourCounts: new Array(24).fill(0),
    updatedAt: new Date(),
  };
}

function emptyMonthly(providerId: string, month: string): ProviderStatsMonthly {
  return {
    providerId, month,
    bookingsCount: 0, confirmedCount: 0, pendingCount: 0, pendingPaymentCount: 0,
    cancelledCount: 0, noshowCount: 0, revenue: 0,
    activityRevenue: 0, activityCount: 0, activitiesByCategory: [],
    clientHashes: [], newClientHashes: [], services: [], members: [],
    hourCounts: new Array(24).fill(0),
    updatedAt: new Date(),
  };
}

function emptyHeatmap(): number[] {
  return new Array(7 * 24).fill(0);
}

// ────────────────────────────────────────────────────────────────
// Daily aggregation
// ────────────────────────────────────────────────────────────────

export interface AggregateOptions {
  providerId: string;
  providerName: string;
  membersById?: Record<string, { name: string }>;
  timezone?: string;
}

export function aggregateBookingsToDaily(
  bookings: BookingLike[],
  opts: AggregateOptions,
): Map<string, ProviderStatsDaily> {
  const tz = opts.timezone ?? DEFAULT_TIMEZONE;
  const dailies = new Map<string, ProviderStatsDaily>();
  const sorted = [...bookings].sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
  const seenClients = new Set<string>();

  for (const b of sorted) {
    const date = dateKeyInTz(b.datetime, tz);
    let daily = dailies.get(date);
    if (!daily) {
      daily = emptyDaily(opts.providerId, date);
      dailies.set(date, daily);
    }

    daily.bookingsCount += 1;
    const sf = STATUS_FIELD[b.status];
    if (sf) (daily[sf] as number) += 1;

    if (b.status === 'confirmed') daily.revenue += b.price ?? 0;

    daily.hourCounts[hourInTz(b.datetime, tz)] += 1;

    const key = getClientKey(b);
    if (key !== 'anonymous') {
      if (!daily.clientHashes.includes(key)) daily.clientHashes.push(key);
      if (!seenClients.has(key)) {
        seenClients.add(key);
        daily.newClientHashes.push(key);
      }
    }

    upsertService(daily.services, b);
    upsertMember(daily.members, b, opts);
  }

  return dailies;
}

function upsertService(arr: ProviderStatsServiceBreakdown[], b: BookingLike) {
  let e = arr.find((x) => x.serviceId === b.serviceId);
  if (!e) {
    e = { serviceId: b.serviceId, serviceName: b.serviceName, bookingsCount: 0, confirmedCount: 0, revenue: 0 };
    arr.push(e);
  }
  e.bookingsCount += 1;
  if (b.status === 'confirmed') {
    e.confirmedCount += 1;
    e.revenue += b.price ?? 0;
  }
}

/**
 * Fold paid activities (BlockedSlot with category set + amount > 0)
 * into the daily docs as the "Autres revenus" track. Mutates the
 * map in place; creates a fresh empty daily on dates that had
 * activities but no bookings. See providerStats.ts (shared package)
 * for the full doc — this is the byte-for-byte equivalent on the
 * functions side.
 */
export function mergeActivitiesIntoDailies(
  activities: BlockedSlotLike[],
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
    let entry = daily.activitiesByCategory.find((e) => e.category === slot.category);
    if (!entry) {
      entry = { category: slot.category, count: 0, revenue: 0 };
      daily.activitiesByCategory.push(entry);
    }
    entry.count += 1;
    entry.revenue += amount;
  }
  return dailies;
}

function upsertMember(arr: ProviderStatsMemberBreakdown[], b: BookingLike, opts: AggregateOptions) {
  const memberId = b.memberId;
  let e = arr.find((x) => x.memberId === memberId);
  if (!e) {
    const name = memberId
      ? opts.membersById?.[memberId]?.name ?? b.memberName ?? 'Membre supprimé'
      : opts.providerName;
    e = { memberId, memberName: name, bookingsCount: 0, confirmedCount: 0, revenue: 0 };
    arr.push(e);
  }
  e.bookingsCount += 1;
  if (b.status === 'confirmed') {
    e.confirmedCount += 1;
    e.revenue += b.price ?? 0;
  }
}

// ────────────────────────────────────────────────────────────────
// Monthly + rolling
// ────────────────────────────────────────────────────────────────

export function aggregateDailiesToMonthly(
  dailies: ProviderStatsDaily[],
  providerId: string,
): Map<string, ProviderStatsMonthly> {
  const monthlies = new Map<string, ProviderStatsMonthly>();
  for (const d of dailies) {
    const month = d.date.slice(0, 7);
    let m = monthlies.get(month);
    if (!m) {
      m = emptyMonthly(providerId, month);
      monthlies.set(month, m);
    }
    m.bookingsCount += d.bookingsCount;
    m.confirmedCount += d.confirmedCount;
    m.pendingCount += d.pendingCount;
    m.pendingPaymentCount += d.pendingPaymentCount;
    m.cancelledCount += d.cancelledCount;
    m.noshowCount += d.noshowCount;
    m.revenue += d.revenue;
    // "Autres revenus" rollup — defaults guard against legacy daily
    // docs written before activityRevenue was added to the schema.
    m.activityRevenue += d.activityRevenue ?? 0;
    m.activityCount += d.activityCount ?? 0;
    for (const c of d.activitiesByCategory ?? []) {
      let e = m.activitiesByCategory.find((x) => x.category === c.category);
      if (!e) { e = { category: c.category, count: 0, revenue: 0 }; m.activitiesByCategory.push(e); }
      e.count += c.count;
      e.revenue += c.revenue;
    }
    for (const h of d.clientHashes) if (!m.clientHashes.includes(h)) m.clientHashes.push(h);
    for (const h of d.newClientHashes) if (!m.newClientHashes.includes(h)) m.newClientHashes.push(h);
    for (let h = 0; h < 24; h++) m.hourCounts[h] += d.hourCounts[h] ?? 0;
    for (const s of d.services) {
      let e = m.services.find((x) => x.serviceId === s.serviceId);
      if (!e) { e = { ...s, bookingsCount: 0, confirmedCount: 0, revenue: 0 }; m.services.push(e); }
      e.bookingsCount += s.bookingsCount;
      e.confirmedCount += s.confirmedCount;
      e.revenue += s.revenue;
    }
    for (const mb of d.members) {
      let e = m.members.find((x) => x.memberId === mb.memberId);
      if (!e) { e = { ...mb, bookingsCount: 0, confirmedCount: 0, revenue: 0 }; m.members.push(e); }
      e.bookingsCount += mb.bookingsCount;
      e.confirmedCount += mb.confirmedCount;
      e.revenue += mb.revenue;
    }
  }
  return monthlies;
}

export function aggregateRolling(
  dailies: ProviderStatsDaily[],
  bookings: BookingLike[],
  providerId: string,
  now: Date,
  tz: string = DEFAULT_TIMEZONE,
): ProviderStatsRolling {
  const cutoff30 = new Date(now.getTime() - 30 * MS_PER_DAY);
  const cutoff90 = new Date(now.getTime() - 90 * MS_PER_DAY);
  const dailiesAfter = (c: Date) => dailies.filter((d) => d.date >= dateKeyInTz(c, tz));

  const heatmap = emptyHeatmap();
  for (const b of bookings) {
    if (b.datetime < cutoff90) continue;
    heatmap[dayOfWeekInTz(b.datetime, tz) * 24 + hourInTz(b.datetime, tz)] += 1;
  }

  return {
    providerId,
    topServices30d: topServices(dailiesAfter(cutoff30)),
    topServices90d: topServices(dailiesAfter(cutoff90)),
    topServicesAllTime: topServices(dailies),
    topClients30d: topClients(bookings, cutoff30),
    topClients90d: topClients(bookings, cutoff90),
    topClientsAllTime: topClients(bookings, null),
    heatmap90d: heatmap,
    updatedAt: new Date(),
  };
}

function topServices(dailies: ProviderStatsDaily[], k = 10): ProviderStatsServiceBreakdown[] {
  const acc = new Map<string, ProviderStatsServiceBreakdown>();
  for (const d of dailies) for (const s of d.services) {
    let e = acc.get(s.serviceId);
    if (!e) { e = { serviceId: s.serviceId, serviceName: s.serviceName, bookingsCount: 0, confirmedCount: 0, revenue: 0 }; acc.set(s.serviceId, e); }
    e.bookingsCount += s.bookingsCount;
    e.confirmedCount += s.confirmedCount;
    e.revenue += s.revenue;
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue || b.bookingsCount - a.bookingsCount).slice(0, k);
}

function topClients(bookings: BookingLike[], cutoff: Date | null, k = 10) {
  const acc = new Map<string, { clientHash: string; bookingsCount: number; revenue: number }>();
  for (const b of bookings) {
    if (cutoff && b.datetime < cutoff) continue;
    const key = getClientKey(b);
    if (key === 'anonymous') continue;
    let e = acc.get(key);
    if (!e) { e = { clientHash: key, bookingsCount: 0, revenue: 0 }; acc.set(key, e); }
    e.bookingsCount += 1;
    if (b.status === 'confirmed') e.revenue += b.price ?? 0;
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue || b.bookingsCount - a.bookingsCount).slice(0, k);
}

// ────────────────────────────────────────────────────────────────
// Clients aggregation + tags
// ────────────────────────────────────────────────────────────────

export const CLIENT_TAG_THRESHOLDS = {
  NEW_DAYS: 30,
  REGULAR_MIN_CONFIRMED: 3,
  REGULAR_MAX_INACTIVE_DAYS: 90,
  VIP_MIN_CONFIRMED: 10,
  VIP_MIN_REVENUE: 50_000,
  AT_RISK_MIN_INACTIVE_DAYS: 60,
  AT_RISK_MAX_INACTIVE_DAYS: 180,
  LOST_MIN_INACTIVE_DAYS: 180,
  NOSHOW_PRONE_MIN_BOOKINGS: 3,
  NOSHOW_PRONE_MIN_RATE: 0.2,
} as const;

export function computeClientTags(
  c: Pick<ProviderClient, 'firstBookingAt' | 'lastBookingAt' | 'bookingsCount' | 'confirmedCount' | 'noshowCount' | 'totalRevenue'>,
  now: Date,
): ProviderClientTag[] {
  const tags: ProviderClientTag[] = [];
  const T = CLIENT_TAG_THRESHOLDS;
  const dSinceFirst = (now.getTime() - c.firstBookingAt.getTime()) / MS_PER_DAY;
  const dSinceLast = (now.getTime() - c.lastBookingAt.getTime()) / MS_PER_DAY;

  if (dSinceFirst <= T.NEW_DAYS) tags.push('new');
  if (c.confirmedCount >= T.REGULAR_MIN_CONFIRMED && dSinceLast <= T.REGULAR_MAX_INACTIVE_DAYS) tags.push('regular');
  if (c.confirmedCount >= T.VIP_MIN_CONFIRMED || c.totalRevenue >= T.VIP_MIN_REVENUE) tags.push('vip');
  if (dSinceLast >= T.AT_RISK_MIN_INACTIVE_DAYS && dSinceLast < T.AT_RISK_MAX_INACTIVE_DAYS) tags.push('at_risk');
  if (dSinceLast >= T.LOST_MIN_INACTIVE_DAYS) tags.push('lost');
  if (c.bookingsCount >= T.NOSHOW_PRONE_MIN_BOOKINGS && c.noshowCount / c.bookingsCount > T.NOSHOW_PRONE_MIN_RATE) tags.push('noshow_prone');
  return tags;
}

export interface AggregateClientsOptions {
  providerId: string;
  registeredUsers?: Record<string, { displayName: string; photoURL: string | null; phone: string | null }>;
}

export function aggregateBookingsToClients(
  bookings: BookingLike[],
  opts: AggregateClientsOptions,
  now: Date = new Date(),
): Map<string, ProviderClient> {
  const sorted = [...bookings].sort((a, b) => {
    const c = a.createdAt.getTime() - b.createdAt.getTime();
    return c !== 0 ? c : a.datetime.getTime() - b.datetime.getTime();
  });
  const clients = new Map<string, ProviderClient>();

  for (const b of sorted) {
    const key = getClientKey(b);
    if (key === 'anonymous') continue;

    let c = clients.get(key);
    if (!c) {
      c = {
        providerId: opts.providerId, clientKey: key,
        email: null, phone: null, name: '',
        clientId: null, photoURL: null,
        bookingsCount: 0, confirmedCount: 0, cancelledCount: 0, noshowCount: 0,
        totalRevenue: 0,
        firstBookingAt: b.datetime, lastBookingAt: b.datetime,
        tags: [], notes: null, preferences: null,
        marketingOptIn: false, marketingOptInAt: null, marketingOptOutAt: null,
        createdAt: b.createdAt, updatedAt: b.createdAt,
      };
      clients.set(key, c);
    }

    c.name = b.clientInfo?.name ?? c.name;
    c.email = b.clientInfo?.email?.toLowerCase().trim() ?? c.email;
    c.phone = b.clientInfo?.phone ?? c.phone;

    if (b.clientId) {
      c.clientId = b.clientId;
      const r = opts.registeredUsers?.[b.clientId];
      if (r) {
        c.name = r.displayName || c.name;
        c.photoURL = r.photoURL ?? c.photoURL;
        c.phone = r.phone ?? c.phone;
      }
    }

    c.bookingsCount += 1;
    if (b.status === 'confirmed') {
      c.confirmedCount += 1;
      c.totalRevenue += b.price ?? 0;
    } else if (b.status === 'cancelled') {
      c.cancelledCount += 1;
    } else if (b.status === 'noshow') {
      c.noshowCount += 1;
    }

    if (b.datetime < c.firstBookingAt) c.firstBookingAt = b.datetime;
    if (b.datetime > c.lastBookingAt) c.lastBookingAt = b.datetime;

    const optIn = b.clientInfo?.marketingOptIn === true;
    if (optIn && !c.marketingOptIn) c.marketingOptInAt = b.createdAt;
    else if (!optIn && c.marketingOptIn) c.marketingOptOutAt = b.createdAt;
    c.marketingOptIn = optIn;

    if (b.createdAt > c.updatedAt) c.updatedAt = b.createdAt;
  }

  for (const c of clients.values()) c.tags = computeClientTags(c, now);
  return clients;
}

// ────────────────────────────────────────────────────────────────
// Doc-id helpers (Firestore composite keys)
// ────────────────────────────────────────────────────────────────

export function dailyDocId(providerId: string, date: string): string {
  return `${providerId}_${date}`;
}
export function monthlyDocId(providerId: string, month: string): string {
  return `${providerId}_${month}`;
}
export function clientDocId(providerId: string, clientKey: string): string {
  return `${providerId}_${clientKey}`;
}
