import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import type { DashboardStats, TrendData, CategoryData, RevenueStats, AnalyticsData, ActivityEvent } from '@/services/admin/types';

/** Return JSON with Cache-Control header to avoid redundant Firestore reads */
function jsonWithCache(data: unknown, maxAgeSeconds: number) {
  const res = NextResponse.json(data);
  res.headers.set('Cache-Control', `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`);
  return res;
}

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const type = request.nextUrl.searchParams.get('type');

    // Trend data requests (cache 2 min)
    if (type === 'signups-trend') {
      const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
      const data = await getSignupsTrend(db, days);
      return jsonWithCache(data, 120);
    }

    if (type === 'bookings-trend') {
      const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
      const data = await getBookingsTrend(db, days);
      return jsonWithCache(data, 120);
    }

    if (type === 'by-category') {
      const data = await getBookingsByCategory(db);
      return jsonWithCache(data, 120);
    }

    // Revenue stats (cache 5 min — Stripe API calls are expensive)
    if (type === 'revenue') {
      const data = await getRevenueStats();
      return jsonWithCache(data, 300);
    }

    // Analytics (cache 5 min — heavy aggregations)
    if (type === 'analytics') {
      const data = await getAnalyticsData(db);
      return jsonWithCache(data, 300);
    }

    // Recent signups (cache 1 min)
    if (type === 'recent-signups') {
      const data = await getRecentSignups(db);
      return jsonWithCache(data, 60);
    }

    // Activity feed (cache 1 min — fresh data desired)
    if (type === 'activity') {
      const data = await getActivityFeed(db);
      return jsonWithCache(data, 60);
    }

    // Default: dashboard stats (cache 5 min — most expensive query)
    const stats = await getDashboardStats(db);
    return jsonWithCache(stats, 300);
  } catch (error) {
    console.error('[admin/stats] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────────────
// Revenue helpers — Stripe is the source of truth.
//
// MRR = recurring revenue normalized to cents/month, NET of the currently
// active coupon (so an affiliate -50% code counts for half, not full price),
// accounting for quantity, split between the core plans (Pro/Studio) and the
// Sérénité add-on (a separate subscription, metadata.productType === 'serenity').
//
// "Encaissé" (collected) = sum of PAID invoice amounts — the real cash that hit
// the account, i.e. the irrefutable "what we actually earned".
// ────────────────────────────────────────────────────────────────────────

/** Gross recurring amount of a subscription, normalized to cents / month. */
function subMonthlyGrossCents(sub: Stripe.Subscription): number {
  let cents = 0;
  for (const item of sub.items.data) {
    const amt = (item.price?.unit_amount || 0) * (item.quantity || 1);
    cents += item.price?.recurring?.interval === 'year' ? amt / 12 : amt;
  }
  return cents;
}

/** Subscription's monthly amount NET of its currently-active coupon(s). */
function subMonthlyNetCents(sub: Stripe.Subscription): number {
  const gross = subMonthlyGrossCents(sub);
  const isYearly = sub.items.data.some((i) => i.price?.recurring?.interval === 'year');
  // `discounts` (plural) is the current field; keep `discount` (legacy) as a
  // fallback. Each Discount carries its Coupon inline.
  const raw = [
    ...(((sub as unknown as { discounts?: unknown[] }).discounts) || []),
    ...((sub as unknown as { discount?: unknown }).discount ? [(sub as unknown as { discount: unknown }).discount] : []),
  ] as Array<{ coupon?: Stripe.Coupon; percent_off?: number; amount_off?: number }>;
  let net = gross;
  for (const d of raw) {
    const coupon = d && typeof d === 'object' ? (d.coupon ?? (d.percent_off || d.amount_off ? d : null)) : null;
    if (!coupon) continue;
    if (coupon.percent_off) net -= gross * (coupon.percent_off / 100);
    else if (coupon.amount_off) net -= isYearly ? coupon.amount_off / 12 : coupon.amount_off;
  }
  return Math.max(0, net);
}

const isSerenitySub = (sub: Stripe.Subscription): boolean =>
  sub.metadata?.productType === 'serenity';

function planLabel(sub: Stripe.Subscription): string {
  const p = sub.metadata?.plan;
  if (p === 'team') return 'Studio';
  if (p === 'solo') return 'Pro';
  return sub.items.data[0]?.price?.nickname || 'Plan';
}

interface SubscriptionRevenue {
  mrrTotal: number;
  mrrPlans: number;
  mrrSerenity: number;
  activeCount: number;
  byPlan: { plan: string; count: number; mrr: number }[];
}

/** Net MRR + per-product breakdown from all ACTIVE subscriptions. */
async function computeSubscriptionRevenue(stripe: Stripe): Promise<SubscriptionRevenue> {
  let mrrTotal = 0, mrrPlans = 0, mrrSerenity = 0, activeCount = 0;
  const byPlan: Record<string, { count: number; mrr: number }> = {};
  for await (const sub of stripe.subscriptions.list({
    status: 'active',
    limit: 100,
    expand: ['data.discounts'],
  })) {
    activeCount++;
    const net = Math.round(subMonthlyNetCents(sub));
    mrrTotal += net;
    const serenity = isSerenitySub(sub);
    const label = serenity ? 'Sérénité (acomptes)' : planLabel(sub);
    if (serenity) mrrSerenity += net; else mrrPlans += net;
    if (!byPlan[label]) byPlan[label] = { count: 0, mrr: 0 };
    byPlan[label].count++;
    byPlan[label].mrr += net;
  }
  const byPlanArr = Object.entries(byPlan)
    .map(([plan, d]) => ({ plan, count: d.count, mrr: d.mrr }))
    .sort((a, b) => b.mrr - a.mrr);
  return { mrrTotal, mrrPlans, mrrSerenity, activeCount, byPlan: byPlanArr };
}

/** Sum of PAID invoice amounts since `sinceUnix` (cents). Server-side filter. */
async function sumPaidInvoicesSince(stripe: Stripe, sinceUnix: number): Promise<number> {
  let total = 0;
  for await (const inv of stripe.invoices.list({ status: 'paid', limit: 100, created: { gte: sinceUnix } })) {
    total += inv.amount_paid || 0;
  }
  return total;
}

/** Single pass over all PAID invoices, bucketed by period (cents). */
async function getCollectedRevenue(
  stripe: Stripe,
  startOfMonthUnix: number,
  thirtyDaysAgoUnix: number,
): Promise<{ allTime: number; thisMonth: number; last30d: number }> {
  let allTime = 0, thisMonth = 0, last30d = 0;
  for await (const inv of stripe.invoices.list({ status: 'paid', limit: 100 })) {
    const amt = inv.amount_paid || 0;
    const created = inv.created || 0;
    allTime += amt;
    if (created >= startOfMonthUnix) thisMonth += amt;
    if (created >= thirtyDaysAgoUnix) last30d += amt;
  }
  return { allTime, thisMonth, last30d };
}

async function getDashboardStats(db: FirebaseFirestore.Firestore): Promise<DashboardStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Read pre-computed stats + lightweight time-based queries in parallel
  // Using select() instead of count() for compatibility with current firebase-admin version
  const [statsDoc, signupsTodaySnap, signupsWeekSnap, signupsMonthSnap, bookingsTodaySnap, bookingsWeekSnap, bookingsMonthSnap] = await Promise.all([
    db.doc('stats/dashboard').get(),
    db.collection('users').where('createdAt', '>=', startOfToday).select().get(),
    db.collection('users').where('createdAt', '>=', startOfWeek).select().get(),
    db.collection('users').where('createdAt', '>=', startOfMonth).select().get(),
    db.collection('bookings').where('createdAt', '>=', startOfToday).select().get(),
    db.collection('bookings').where('createdAt', '>=', startOfWeek).select().get(),
    db.collection('bookings').where('createdAt', '>=', startOfMonth).select().get(),
  ]);

  const s = statsDoc.data() || {};

  const totalUsers = s.totalUsers || 0;
  const totalClients = s.totalClients || 0;
  const totalProviders = s.totalProviders || 0;
  const activeProviders = s.activeProviders || 0;
  const totalBookings = s.totalBookings || 0;
  const cancelledBookings = s.cancelledBookings || 0;
  const noshowBookings = s.noshowBookings || 0;
  const totalReviews = s.totalReviews || 0;
  const ratingSum = s.ratingSum || 0;
  const trialProv = s.trialProviders || 0;
  const convertedProv = s.convertedProviders || 0;

  // Derived stats
  const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
  const noshowRate = totalBookings > 0 ? (noshowBookings / totalBookings) * 100 : 0;
  const averageRating = totalReviews > 0 ? ratingSum / totalReviews : 0;
  const trialConversionRate =
    trialProv + convertedProv > 0
      ? (convertedProv / (trialProv + convertedProv)) * 100
      : 0;

  // Revenue from Stripe (source of truth): NET MRR (after discounts, all
  // products) + the real cash collected this month (paid invoices).
  let mrr = 0;
  let collectedThisMonth = 0;
  try {
    const stripe = getStripe();
    const [subRev, collected] = await Promise.all([
      computeSubscriptionRevenue(stripe),
      sumPaidInvoicesSince(stripe, Math.floor(startOfMonth.getTime() / 1000)),
    ]);
    mrr = subRev.mrrTotal;
    collectedThisMonth = collected;
  } catch (err) {
    console.error('[admin/stats] Stripe revenue error:', err);
  }

  return {
    totalUsers,
    totalClients,
    totalProviders,
    newSignupsToday: signupsTodaySnap.size,
    newSignupsWeek: signupsWeekSnap.size,
    newSignupsMonth: signupsMonthSnap.size,
    activeProviders,
    totalBookings,
    bookingsToday: bookingsTodaySnap.size,
    bookingsWeek: bookingsWeekSnap.size,
    bookingsMonth: bookingsMonthSnap.size,
    mrr,
    collectedThisMonth,
    cancellationRate: Math.round(cancellationRate * 10) / 10,
    noshowRate: Math.round(noshowRate * 10) / 10,
    averageRating: Math.round(averageRating * 10) / 10,
    trialConversionRate: Math.round(trialConversionRate * 10) / 10,
  };
}

async function getSignupsTrend(db: FirebaseFirestore.Firestore, days: number): Promise<TrendData[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const usersSnap = await db
    .collection('users')
    .where('createdAt', '>=', startDate)
    .get();

  // Group by date
  const countByDate: Record<string, number> = {};
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    countByDate[d.toISOString().split('T')[0]] = 0;
  }

  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const created = data.createdAt?.toDate?.() || new Date(data.createdAt);
    const dateStr = created.toISOString().split('T')[0];
    if (countByDate[dateStr] !== undefined) {
      countByDate[dateStr]++;
    }
  });

  return Object.entries(countByDate).map(([date, count]) => ({ date, count }));
}

async function getBookingsTrend(db: FirebaseFirestore.Firestore, days: number): Promise<TrendData[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const bookingsSnap = await db
    .collection('bookings')
    .where('createdAt', '>=', startDate)
    .get();

  const countByDate: Record<string, number> = {};
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    countByDate[d.toISOString().split('T')[0]] = 0;
  }

  bookingsSnap.docs.forEach((doc) => {
    const data = doc.data();
    const created = data.createdAt?.toDate?.() || new Date(data.createdAt);
    const dateStr = created.toISOString().split('T')[0];
    if (countByDate[dateStr] !== undefined) {
      countByDate[dateStr]++;
    }
  });

  return Object.entries(countByDate).map(([date, count]) => ({ date, count }));
}

async function getBookingsByCategory(db: FirebaseFirestore.Firestore): Promise<CategoryData[]> {
  // Read from pre-computed stats document (1 read instead of full collection scans)
  const statsDoc = await db.doc('stats/dashboard').get();
  const countByCategory: Record<string, number> = statsDoc.data()?.bookingsByCategory || {};

  const categoryLabels: Record<string, string> = {
    coiffure: 'Coiffure',
    barbier: 'Barbier',
    esthetique: 'Esthétique',
    massage: 'Massage',
    onglerie: 'Onglerie',
    tatouage: 'Tatouage',
    maquillage: 'Maquillage',
    soin_visage: 'Soin visage',
    Autre: 'Autre',
  };

  return Object.entries(countByCategory)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category,
      label: categoryLabels[category] || category,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

async function getAnalyticsData(db: FirebaseFirestore.Firestore): Promise<AnalyticsData> {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const categoryLabels: Record<string, string> = {
    coiffure: 'Coiffure',
    barbier: 'Barbier',
    esthetique: 'Esthétique',
    massage: 'Massage',
    onglerie: 'Onglerie',
    tatouage: 'Tatouage',
    maquillage: 'Maquillage',
    soin_visage: 'Soin visage',
    Autre: 'Autre',
  };

  // Parallel queries — all use select() for minimal data transfer
  const [providersSnap, bookingsSnap, usersSnap, statsDoc] = await Promise.all([
    db.collection('providers').select('businessName', 'photoURL', 'category', 'cities', 'rating').get(),
    db.collection('bookings').where('createdAt', '>=', threeMonthsAgo).select('providerId', 'datetime', 'status', 'category').get(),
    db.collection('users').where('createdAt', '>=', twelveMonthsAgo).select('role', 'createdAt').get(),
    db.doc('stats/dashboard').get(),
  ]);

  // ── Top cities ──
  const cityProviders: Record<string, number> = {};
  providersSnap.docs.forEach((doc) => {
    const cities: string[] = doc.data().cities || [];
    cities.forEach((city) => {
      if (city) cityProviders[city] = (cityProviders[city] || 0) + 1;
    });
  });

  const cityBookings: Record<string, number> = {};
  // Count bookings per provider, then map to their cities
  const bookingsByProvider: Record<string, number> = {};
  bookingsSnap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.providerId) {
      bookingsByProvider[d.providerId] = (bookingsByProvider[d.providerId] || 0) + 1;
    }
  });

  // Map provider bookings to their cities
  providersSnap.docs.forEach((doc) => {
    const cities: string[] = doc.data().cities || [];
    const provBookings = bookingsByProvider[doc.id] || 0;
    if (provBookings > 0) {
      cities.forEach((city) => {
        if (city) cityBookings[city] = (cityBookings[city] || 0) + provBookings;
      });
    }
  });

  const topCities = Object.keys(cityProviders)
    .map((city) => ({
      city,
      providers: cityProviders[city] || 0,
      bookings: cityBookings[city] || 0,
    }))
    .sort((a, b) => b.providers - a.providers)
    .slice(0, 10);

  // ── Top providers ──
  const topProviders = providersSnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        businessName: d.businessName || 'Sans nom',
        photoURL: d.photoURL || undefined,
        category: categoryLabels[d.category] || d.category || 'Autre',
        bookings: bookingsByProvider[doc.id] || 0,
        rating: d.rating?.average || 0,
        ratingCount: d.rating?.count || 0,
      };
    })
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);

  // ── Signups by month ──
  const signupsByMonthMap: Record<string, { clients: number; providers: number }> = {};
  // Init last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    signupsByMonthMap[key] = { clients: 0, providers: 0 };
  }

  usersSnap.docs.forEach((doc) => {
    const d = doc.data();
    const created = d.createdAt?.toDate?.() || new Date(d.createdAt);
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    if (signupsByMonthMap[key]) {
      if (d.role === 'provider') {
        signupsByMonthMap[key].providers++;
      } else {
        signupsByMonthMap[key].clients++;
      }
    }
  });

  const signupsByMonth = Object.entries(signupsByMonthMap).map(([month, data]) => ({
    month,
    clients: data.clients,
    providers: data.providers,
  }));

  // ── Peak hours ──
  const hourCounts: number[] = new Array(24).fill(0);
  bookingsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const dt = d.datetime?.toDate?.() || (d.datetime ? new Date(d.datetime) : null);
    if (dt && !isNaN(dt.getTime())) {
      hourCounts[dt.getHours()]++;
    }
  });

  const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

  // ── Category breakdown ──
  const providersByCategory: Record<string, number> = {};
  providersSnap.docs.forEach((doc) => {
    const cat = doc.data().category || 'Autre';
    providersByCategory[cat] = (providersByCategory[cat] || 0) + 1;
  });

  const bookingsByCategoryStats: Record<string, number> = statsDoc.data()?.bookingsByCategory || {};

  const allCategories = new Set([...Object.keys(providersByCategory), ...Object.keys(bookingsByCategoryStats)]);
  const categoryBreakdown = Array.from(allCategories)
    .map((category) => ({
      category,
      label: categoryLabels[category] || category,
      providers: providersByCategory[category] || 0,
      bookings: bookingsByCategoryStats[category] || 0,
    }))
    .filter((c) => c.providers > 0 || c.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings);

  return {
    topCities,
    topProviders,
    signupsByMonth,
    peakHours,
    categoryBreakdown,
  };
}

async function getActivityFeed(db: FirebaseFirestore.Firestore): Promise<ActivityEvent[]> {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // 4 parallel queries, each limited to recent docs
  const [providersSnap, bookingsSnap, reviewsSnap, usersSnap] = await Promise.all([
    db.collection('providers')
      .where('createdAt', '>=', twoDaysAgo)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .select('businessName', 'createdAt')
      .get(),
    db.collection('bookings')
      .where('createdAt', '>=', twoDaysAgo)
      .orderBy('createdAt', 'desc')
      .limit(15)
      .select('clientName', 'providerName', 'status', 'createdAt')
      .get(),
    db.collection('reviews')
      .where('createdAt', '>=', twoDaysAgo)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .select('clientName', 'rating', 'providerName', 'createdAt')
      .get(),
    db.collection('users')
      .where('createdAt', '>=', twoDaysAgo)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .select('displayName', 'role', 'createdAt')
      .get(),
  ]);

  const events: ActivityEvent[] = [];

  // New providers
  providersSnap.docs.forEach((doc) => {
    const d = doc.data();
    const ts = d.createdAt?.toDate?.() || new Date(d.createdAt);
    events.push({
      id: `prov-${doc.id}`,
      type: 'new_provider',
      title: 'Nouveau prestataire',
      description: d.businessName || 'Sans nom',
      timestamp: ts.toISOString(),
      metadata: { providerId: doc.id },
    });
  });

  // Bookings (new + cancelled)
  bookingsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const ts = d.createdAt?.toDate?.() || new Date(d.createdAt);
    const isCancelled = d.status === 'cancelled' || d.status === 'cancelled_by_provider' || d.status === 'cancelled_by_client';

    events.push({
      id: `book-${doc.id}`,
      type: isCancelled ? 'cancelled_booking' : 'new_booking',
      title: isCancelled ? 'Annulation' : 'Nouvelle réservation',
      description: `${d.clientName || 'Client'} chez ${d.providerName || 'Prestataire'}`,
      timestamp: ts.toISOString(),
      metadata: { bookingId: doc.id },
    });
  });

  // Reviews
  reviewsSnap.docs.forEach((doc) => {
    const d = doc.data();
    const ts = d.createdAt?.toDate?.() || new Date(d.createdAt);
    events.push({
      id: `rev-${doc.id}`,
      type: 'new_review',
      title: 'Nouvel avis',
      description: `${d.clientName || 'Client'} — ${d.rating || 0}★`,
      timestamp: ts.toISOString(),
    });
  });

  // New users
  usersSnap.docs.forEach((doc) => {
    const d = doc.data();
    const ts = d.createdAt?.toDate?.() || new Date(d.createdAt);
    events.push({
      id: `user-${doc.id}`,
      type: 'new_user',
      title: 'Nouvel utilisateur',
      description: d.displayName || 'Utilisateur',
      timestamp: ts.toISOString(),
    });
  });

  // Sort by timestamp desc, return top 30
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 30);
}

async function getRecentSignups(db: FirebaseFirestore.Firestore) {
  // Fetch last 10 providers and last 30 users (filter clients in-memory to avoid composite index)
  const [providersSnap, usersSnap] = await Promise.all([
    db.collection('providers')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .select('businessName', 'category', 'photoURL', 'subscription', 'cities', 'createdAt')
      .get(),
    db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .select('displayName', 'email', 'photoURL', 'role', 'createdAt')
      .get(),
  ]);

  const providers = providersSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      businessName: d.businessName || 'Sans nom',
      category: d.category || '',
      photoURL: d.photoURL || null,
      plan: d.subscription?.plan || 'trial',
      city: d.cities?.[0] || null,
      createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
    };
  });

  const clients = usersSnap.docs
    .filter((doc) => doc.data().role === 'client')
    .slice(0, 10)
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        displayName: d.displayName || null,
        email: d.email || null,
        photoURL: d.photoURL || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

  return { providers, clients };
}

async function getRevenueStats(): Promise<RevenueStats> {
  const stripe = getStripe();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonthUnix = Math.floor(startOfMonth.getTime() / 1000);
  const thirtyDaysAgoUnix = Math.floor(thirtyDaysAgo.getTime() / 1000);

  // NET MRR + per-product breakdown (Pro/Studio vs Sérénité), and the real
  // cash collected (paid invoices) — computed in parallel.
  const [subRev, collected] = await Promise.all([
    computeSubscriptionRevenue(stripe),
    getCollectedRevenue(stripe, startOfMonthUnix, thirtyDaysAgoUnix),
  ]);

  // Count trialing subscriptions
  let trialCount = 0;
  for await (const _sub of stripe.subscriptions.list({ status: 'trialing', limit: 100 })) {
    trialCount++;
  }

  // Count cancelled subscriptions this month
  let cancelledThisMonth = 0;
  for await (const _sub of stripe.subscriptions.list({
    status: 'canceled',
    limit: 100,
    created: { gte: startOfMonthUnix },
  })) {
    cancelledThisMonth++;
  }

  // Recent invoices: last 20 paid + last 5 open, merged and sorted
  const [invoices, failedInvoices] = await Promise.all([
    stripe.invoices.list({ limit: 20, status: 'paid' }),
    stripe.invoices.list({ limit: 5, status: 'open' }),
  ]);

  const allInvoices = [...invoices.data, ...failedInvoices.data]
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 20);

  const recentPayments = allInvoices.map((inv) => ({
    id: inv.id,
    amount: inv.amount_paid || inv.amount_due || 0,
    currency: inv.currency || 'eur',
    status: inv.status || 'unknown',
    customerEmail: inv.customer_email || null,
    providerName: inv.customer_name || null,
    description: inv.lines?.data?.[0]?.description || null,
    created: new Date((inv.created || 0) * 1000).toISOString(),
  }));

  return {
    mrr: subRev.mrrTotal,
    mrrPlans: subRev.mrrPlans,
    mrrSerenity: subRev.mrrSerenity,
    collectedThisMonth: collected.thisMonth,
    collectedLast30d: collected.last30d,
    collectedAllTime: collected.allTime,
    activeSubscriptions: subRev.activeCount,
    trialSubscriptions: trialCount,
    cancelledThisMonth,
    subscriptionsByPlan: subRev.byPlan,
    recentPayments,
  };
}
