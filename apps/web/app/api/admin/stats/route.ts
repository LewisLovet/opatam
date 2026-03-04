import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import type { DashboardStats, TrendData, CategoryData, RevenueStats } from '@/services/admin/types';

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

    // Default: dashboard stats (cache 5 min — most expensive query)
    const stats = await getDashboardStats(db);
    return jsonWithCache(stats, 300);
  } catch (error) {
    console.error('[admin/stats] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
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

  // MRR from Stripe (external API, not Firestore reads)
  let mrr = 0;
  try {
    const stripe = getStripe();
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { status: 'active', limit: 100 };
      if (startingAfter) params.starting_after = startingAfter;

      const subscriptions = await stripe.subscriptions.list(params);

      for (const sub of subscriptions.data) {
        for (const item of sub.items.data) {
          const amount = (item.price?.unit_amount || 0);
          const interval = item.price?.recurring?.interval;
          if (interval === 'year') {
            mrr += Math.round(amount / 12);
          } else {
            mrr += amount;
          }
        }
      }

      hasMore = subscriptions.has_more;
      if (hasMore && subscriptions.data.length > 0) {
        startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
      }
    }
  } catch (err) {
    console.error('[admin/stats] Stripe MRR error:', err);
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

async function getRevenueStats(): Promise<RevenueStats> {
  const stripe = getStripe();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let mrr = 0;
  let activeCount = 0;
  let trialCount = 0;
  const planCounts: Record<string, { count: number; mrr: number }> = {};
  const productNameCache: Record<string, string> = {};

  // Page through active subscriptions to compute MRR + plan breakdown
  for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
    activeCount++;
    for (const item of sub.items.data) {
      const amount = item.price?.unit_amount || 0;
      const interval = item.price?.recurring?.interval;
      const monthlyAmount = interval === 'year' ? Math.round(amount / 12) : amount;
      mrr += monthlyAmount;

      // Collect product ID for later name resolution
      const productId = typeof item.price?.product === 'string'
        ? item.price.product
        : (item.price?.product as Stripe.Product)?.id;
      const key = item.price?.nickname || productId || 'autre';
      if (!planCounts[key]) planCounts[key] = { count: 0, mrr: 0 };
      planCounts[key].count++;
      planCounts[key].mrr += monthlyAmount;

      // Track product IDs that need name resolution
      if (productId && !productNameCache[productId]) {
        productNameCache[productId] = productId; // placeholder
      }
    }
  }

  // Resolve product IDs to human-readable names
  const productIds = Object.keys(productNameCache);
  if (productIds.length > 0) {
    await Promise.all(
      productIds.map(async (id) => {
        try {
          const product = await stripe.products.retrieve(id);
          productNameCache[id] = product.name || id;
        } catch {
          // keep the ID as fallback
        }
      })
    );

    // Rebuild planCounts with resolved names
    const resolved: Record<string, { count: number; mrr: number }> = {};
    for (const [key, data] of Object.entries(planCounts)) {
      const name = productNameCache[key] || key;
      if (!resolved[name]) resolved[name] = { count: 0, mrr: 0 };
      resolved[name].count += data.count;
      resolved[name].mrr += data.mrr;
    }
    // Replace planCounts contents
    for (const k of Object.keys(planCounts)) delete planCounts[k];
    Object.assign(planCounts, resolved);
  }

  // Count trialing subscriptions
  for await (const _sub of stripe.subscriptions.list({ status: 'trialing', limit: 100 })) {
    trialCount++;
  }

  // Count cancelled subscriptions this month
  let cancelledThisMonth = 0;
  for await (const _sub of stripe.subscriptions.list({
    status: 'canceled',
    limit: 100,
    created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
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

  const subscriptionsByPlan = Object.entries(planCounts)
    .map(([plan, data]) => ({
      plan,
      count: data.count,
      mrr: data.mrr,
    }))
    .sort((a, b) => b.mrr - a.mrr);

  return {
    mrr,
    activeSubscriptions: activeCount,
    trialSubscriptions: trialCount,
    cancelledThisMonth,
    subscriptionsByPlan,
    recentPayments,
  };
}
