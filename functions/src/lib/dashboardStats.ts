/**
 * Dashboard stats — source-of-truth recompute.
 *
 * The `stats/dashboard` doc was maintained ONLY by incremental triggers
 * (onStatsUpdate.ts) with no way to self-correct: any event missed/duplicated,
 * or created before the triggers shipped, drifted the counters permanently —
 * and test/internal accounts inflated every number. This module recounts the
 * whole doc from the collections, EXCLUDING internal/test accounts, with
 * corrected definitions. It's idempotent: run it daily (cron) + on demand
 * (admin button) and the numbers heal.
 *
 * Definitions (the fixes):
 *  - activeProviders   = PAYING providers (subscription active + plan solo/team),
 *                        not "has a published page" as before.
 *  - publishedProviders = providers with a published page (kept separately).
 *  - trialConversionRate = of providers whose trial is DECIDED (no longer
 *                        trialing), the share that ever converted to paid —
 *                        a real cohort, not a fragile current-snapshot ratio.
 *  - cancellation/noshow = over REAL bookings (pending_payment abandoned
 *                        checkouts excluded).
 */

import * as admin from 'firebase-admin';

// ── Internal/test account exclusion ────────────────────────────────────────
// Extend these as you create test accounts. A user/provider also counts as
// internal when `isTest === true`, `isAdmin === true`, the provider plan is the
// 'test' plan, or the email is on a disposable test domain.
const TEST_UIDS = new Set<string>([
  // e.g. 'rgq0JPuTOKPim9xKdjWO3LanDSI3',
]);
const TEST_EMAILS = new Set<string>([
  // e.g. 'opatam@yopmail.com',
]);
const TEST_EMAIL_DOMAINS = ['yopmail.com'];

function emailIsTest(email: unknown): boolean {
  if (typeof email !== 'string' || !email) return false;
  const e = email.toLowerCase();
  if (TEST_EMAILS.has(e)) return true;
  const domain = e.split('@')[1];
  return !!domain && TEST_EMAIL_DOMAINS.includes(domain);
}

export function isInternalUser(uid: string, d: FirebaseFirestore.DocumentData): boolean {
  return (
    d.isTest === true ||
    d.isAdmin === true ||
    TEST_UIDS.has(uid) ||
    emailIsTest(d.email)
  );
}

function isInternalProvider(
  id: string,
  d: FirebaseFirestore.DocumentData,
  testUserUids: Set<string>,
): boolean {
  return (
    d.isTest === true ||
    d.subscription?.plan === 'test' ||
    TEST_UIDS.has(id) ||
    testUserUids.has(id) || // provider doc id === user uid in this app
    emailIsTest(d.email) ||
    emailIsTest(d.contactEmail)
  );
}

const PAID_PLANS = new Set(['solo', 'team']);

/** Has this provider ever converted to a paid subscription? */
function everConverted(sub: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!sub) return false;
  return (
    PAID_PLANS.has(sub.plan) ||
    !!sub.stripeSubscriptionId ||
    (sub.paymentSource != null && sub.paymentSource !== undefined)
  );
}

export interface DashboardStatsDoc {
  totalUsers: number;
  totalClients: number;
  totalProviders: number;
  activeProviders: number; // paying
  publishedProviders: number;
  totalBookings: number; // excludes abandoned pending_payment
  cancelledBookings: number;
  noshowBookings: number;
  totalReviews: number;
  ratingSum: number;
  trialProviders: number; // currently trialing
  convertedProviders: number; // ever converted to paid
  lostTrials: number; // trial decided, never converted
  bookingsByCategory: Record<string, number>;
  // Derived (stored so the API doesn't re-derive with the old flawed formula)
  cancellationRate: number;
  noshowRate: number;
  averageRating: number;
  trialConversionRate: number;
  recomputedAt: Date;
  updatedAt: Date;
}

/**
 * Recompute the entire dashboard stats doc from the collections, excluding
 * internal/test accounts. Pure read + compute; the caller writes the result.
 */
export async function recomputeDashboardStats(
  db: admin.firestore.Firestore,
): Promise<DashboardStatsDoc> {
  // ── Users ────────────────────────────────────────────────────────────────
  const usersSnap = await db.collection('users').get();
  const testUserUids = new Set<string>();
  let totalUsers = 0;
  let totalClients = 0;
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    if (isInternalUser(doc.id, d)) {
      testUserUids.add(doc.id);
      continue;
    }
    totalUsers++;
    if (d.role === 'client') totalClients++;
  }

  // ── Providers ────────────────────────────────────────────────────────────
  const providersSnap = await db.collection('providers').get();
  const testProviderIds = new Set<string>();
  let totalProviders = 0;
  let activeProviders = 0; // paying
  let publishedProviders = 0;
  let trialProviders = 0;
  let convertedProviders = 0;
  let lostTrials = 0;
  for (const doc of providersSnap.docs) {
    const d = doc.data();
    if (isInternalProvider(doc.id, d, testUserUids)) {
      testProviderIds.add(doc.id);
      continue;
    }
    totalProviders++;
    const sub = d.subscription;
    const status = sub?.status;
    const plan = sub?.plan;
    // Trialing = the ACTIVE trial state only. `plan` stays 'trial' even after
    // the trial expires, so keying on plan would count expired trials as
    // trialing forever and they'd never land in `lostTrials`.
    const isTrialing = status === 'trialing';
    const isPaying = status === 'active' && PAID_PLANS.has(plan);

    if (isPaying) activeProviders++;
    if (d.isPublished === true) publishedProviders++;

    if (isTrialing) {
      trialProviders++;
    } else if (everConverted(sub)) {
      convertedProviders++;
    } else {
      // Trial decided (no longer trialing) but never paid.
      lostTrials++;
    }
  }

  // ── Bookings ─────────────────────────────────────────────────────────────
  const bookingsSnap = await db.collection('bookings').get();
  let totalBookings = 0;
  let cancelledBookings = 0;
  let noshowBookings = 0;
  const bookingsByCategory: Record<string, number> = {};
  // Provider → category lookup (skip test providers' bookings entirely).
  const categoryByProvider = new Map<string, string>();
  for (const doc of providersSnap.docs) {
    categoryByProvider.set(doc.id, doc.data().category || 'Autre');
  }
  for (const doc of bookingsSnap.docs) {
    const d = doc.data();
    const providerId = d.providerId;
    if (providerId && testProviderIds.has(providerId)) continue; // test booking
    // Abandoned deposit checkouts never became real bookings.
    if (d.status === 'pending_payment') continue;
    totalBookings++;
    if (d.status === 'cancelled') cancelledBookings++;
    if (d.status === 'noshow') noshowBookings++;
    const cat = categoryByProvider.get(providerId) || 'Autre';
    bookingsByCategory[cat] = (bookingsByCategory[cat] || 0) + 1;
  }

  // ── Reviews ──────────────────────────────────────────────────────────────
  const reviewsSnap = await db.collection('reviews').get();
  let totalReviews = 0;
  let ratingSum = 0;
  for (const doc of reviewsSnap.docs) {
    const d = doc.data();
    if (d.providerId && testProviderIds.has(d.providerId)) continue;
    totalReviews++;
    ratingSum += d.rating || 0;
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const cancellationRate = totalBookings > 0 ? round1((cancelledBookings / totalBookings) * 100) : 0;
  const noshowRate = totalBookings > 0 ? round1((noshowBookings / totalBookings) * 100) : 0;
  const averageRating = totalReviews > 0 ? round1(ratingSum / totalReviews) : 0;
  // Cohort: of providers whose trial is decided (converted OR lost), how many converted.
  const decided = convertedProviders + lostTrials;
  const trialConversionRate = decided > 0 ? round1((convertedProviders / decided) * 100) : 0;

  const now = new Date();
  return {
    totalUsers,
    totalClients,
    totalProviders,
    activeProviders,
    publishedProviders,
    totalBookings,
    cancelledBookings,
    noshowBookings,
    totalReviews,
    ratingSum,
    trialProviders,
    convertedProviders,
    lostTrials,
    bookingsByCategory,
    cancellationRate,
    noshowRate,
    averageRating,
    trialConversionRate,
    recomputedAt: now,
    updatedAt: now,
  };
}
