/**
 * Synthetic data for the affiliate dashboard demo mode.
 * Enabled with ?demo=1 in the URL. Lets you preview what the space
 * looks like when populated, without touching Firestore.
 *
 * Scenario:
 *   - 123 total referrals
 *   - 12 currently in trial (no commission yet)
 *   - 10 first-month paying (only the checkout payment, 50% off)
 *   - 101 on recurring (1 checkout + N monthly invoice payments)
 *
 * Safe to remove once real data is flowing through.
 */

import { Timestamp } from 'firebase/firestore';
import type {
  AffiliateData,
  LogEntry,
  ReferralProvider,
  MonthlyStat,
  TopReferralAggregate,
} from './useAffiliate';

// ────────────────────────────────────────────────────────────────────────────
// Deterministic PRNG so every dashboard load produces the same demo data
// ────────────────────────────────────────────────────────────────────────────

function makePrng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function ts(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
}

// Commission per payment (in cents) — matches real pricing (19.90€ TTC, TVA 20%, 20% commission)
const FIRST_MONTH_COMMISSION_CENTS = Math.round((995 / 1.2) * 0.2); // 166 cents — 50% discount applied
const RECURRING_COMMISSION_CENTS = Math.round((1990 / 1.2) * 0.2); // 332 cents

const BUSINESS_NAMES = [
  'Studio Beauté Élégance', 'Barbershop Rive Droite', 'Spa Zen Lyon',
  'Coiffure Marseille', 'Esthétique Paris 11', 'Nails & Glow', 'Institut Pure',
  'Coiffure & Co', 'Barber 4U', 'Atelier Ongles', 'Zen Attitude',
  'Studio Moderne', 'Salon Vintage', 'Beauté Plus', 'Esthétique Moderne',
  'Coiffure Chic', 'Onglerie Luxe', 'Spa Privilège', 'Barbershop Nord',
  'Studio Épilation', 'Massage Thérapie', 'Nail Art Studio', 'Beauté Express',
  'Salon Marine', 'Les Nails de Léa', 'Barbershop Central', 'Spa Évasion',
  'Coiffure Tendance', 'Épil Center', 'Harmonie Zen', 'Le Chignon Blond',
  'Esthétique Delphine', 'Institut Rose', 'Studio Hair', 'Barber Classic',
  'Onglerie Reine', 'Salon Sophie', 'Beauté Artisan', 'Le Spa du Village',
  'Coiffure Aurélie', 'Massage Bien-Être', 'Barbier du Marché', 'Nail Station',
  'Glow Up Studio', 'Salon Élite', 'Coiffure Bordeaux', 'Spa Nature',
  'Beauté Suprême', 'Barbershop Prestige', 'Onglerie Saint-Michel',
  'Coiffure Audrey', 'Studio Wellness', 'Esthétique Caroline',
  'Nails Factory', 'Institut Féminin', 'Barbier Hipster', 'Salon Charme',
  'Spa Oasis', 'Beauté Pop', 'Coiffure Studio 7', 'Onglerie Pure',
  'Barber Royal', 'Studio Éclat', 'Esthétique Aurore', 'Nail Palace',
  'Institut Soleil', 'Coiffure Mistral', 'Spa Panacea', 'Beauté Flore',
  'Barbershop Notre-Dame', 'Salon Quartz', 'Onglerie Diamond',
  'Institut Lumière', 'Coiffure Hera', 'Spa du Lac', 'Esthétique Julia',
  'Nail Zen', 'Barber House', 'Studio Pastel', 'Beauté Bohème',
  'Coiffure Royale', 'Onglerie Rosée', 'Spa Cristal', 'Barbershop Boréal',
  'Institut Athéna', 'Esthétique Céline', 'Salon Flora',
  'Coiffure Marine', 'Onglerie Jade', 'Spa Horizon', 'Beauté Pop Up',
  'Barbier Tradition', 'Institut Emma', 'Studio Minimal', 'Coiffure Nova',
  'Onglerie Sublime', 'Esthétique Zoé', 'Barbershop Libre',
  'Salon Caramel', 'Spa du Phénix', 'Nail Vip', 'Institut Mystik',
  'Coiffure Eva', 'Onglerie Velvet', 'Barbier du Sud', 'Salon Terre',
  'Esthétique Prune', 'Spa Perle', 'Beauté Nacre', 'Coiffure Moka',
  'Onglerie Amber', 'Barbershop Titan', 'Studio Aurora', 'Institut Horizon',
  'Coiffure Sara', 'Esthétique Nola', 'Salon Ivoire', 'Nail Gallery',
  'Onglerie Sable', 'Spa Mandala', 'Coiffure Léna', 'Beauté Azur',
];

// ────────────────────────────────────────────────────────────────────────────
// Build the 3 cohorts of referrals
// ────────────────────────────────────────────────────────────────────────────

interface Cohort {
  status: 'trialing' | 'active';
  plan: string;
  ageDays: number;
  monthlyPayments: number; // how many invoice renewals this sub has generated
}

// Use a fresh seeded PRNG inside the function so every call returns exactly
// the same cohorts — otherwise buildDemoAffiliate / Logs / Referrals would
// get different data and the totals wouldn't match the per-row figures.
function buildReferralCohorts(): Cohort[] {
  const rand = makePrng(42);
  const cohorts: Cohort[] = [];

  // 12 en essai — signed up 1-14 days ago, no payments yet
  for (let i = 0; i < 12; i++) {
    cohorts.push({
      status: 'trialing',
      plan: 'trial',
      ageDays: 1 + Math.floor(rand() * 14),
      monthlyPayments: 0,
    });
  }

  // 10 first-month active — signed up 15-40 days ago, 1 checkout, 0 invoice
  for (let i = 0; i < 10; i++) {
    cohorts.push({
      status: 'active',
      plan: 'monthly',
      ageDays: 15 + Math.floor(rand() * 26),
      monthlyPayments: 0,
    });
  }

  // 101 recurring active — signed up 45-365 days ago, 1 checkout + N invoices
  for (let i = 0; i < 101; i++) {
    const ageDays = 45 + Math.floor(rand() * 320);
    // roughly 1 invoice per 30 days since signup (after the free first-month trial period)
    const monthlyPayments = Math.floor(ageDays / 30);
    cohorts.push({
      status: 'active',
      plan: 'monthly',
      ageDays,
      monthlyPayments,
    });
  }

  return cohorts;
}

export function buildDemoAffiliate(): AffiliateData {
  const cohorts = buildReferralCohorts();

  // Recompute totals from the cohorts so everything is coherent with the logs
  let totalCommissionCents = 0;
  let totalRevenueCents = 0;

  for (const c of cohorts) {
    if (c.status === 'trialing') continue;
    // 1 first-month checkout payment
    totalCommissionCents += FIRST_MONTH_COMMISSION_CENTS;
    totalRevenueCents += 995; // 50% off
    // N recurring invoice payments
    totalCommissionCents += c.monthlyPayments * RECURRING_COMMISSION_CENTS;
    totalRevenueCents += c.monthlyPayments * 1990;
  }

  // Match the real webhook: refunds decrement the aggregate counters (transfer
  // reversals), keeping the dashboard total in sync with the "Net" on /virements
  const refundCount = 3;
  totalCommissionCents -= refundCount * RECURRING_COMMISSION_CENTS;
  totalRevenueCents -= refundCount * 1990;

  return {
    id: 'demo-affiliate',
    name: 'Démo',
    email: 'demo@opatam.com',
    code: 'DEMO',
    commission: 20,
    discount: 50,
    discountDuration: 'once',
    stripeAccountId: 'acct_demo',
    stripeAccountStatus: 'active',
    stats: {
      totalReferrals: 123,
      activeReferrals: 111,
      trialReferrals: 12,
      totalRevenue: totalRevenueCents,
      totalCommission: totalCommissionCents,
      linkClicks: 1873,
    },
    createdAt: ts(daysAgo(365)),
  };
}

export function buildDemoReferrals(): ReferralProvider[] {
  const cohorts = buildReferralCohorts();
  const refs: ReferralProvider[] = [];

  for (let i = 0; i < cohorts.length; i++) {
    const c = cohorts[i];
    refs.push({
      id: `demo-provider-${i}`,
      businessName: BUSINESS_NAMES[i % BUSINESS_NAMES.length],
      createdAt: ts(daysAgo(c.ageDays)),
      subscription: { status: c.status, plan: c.plan },
    });
  }

  return refs;
}

export function buildDemoLogs(): LogEntry[] {
  const cohorts = buildReferralCohorts();
  const logs: LogEntry[] = [];
  let logId = 0;

  for (let i = 0; i < cohorts.length; i++) {
    const c = cohorts[i];
    if (c.status === 'trialing') continue; // no payments during trial

    const providerId = `demo-provider-${i}`;
    const signupDay = c.ageDays;

    // 1st-month checkout payment — happens a few days after signup
    logs.push({
      id: `demo-log-${logId++}`,
      type: 'payment',
      amount: 995,
      commission: FIRST_MONTH_COMMISSION_CENTS,
      commissionRate: 20,
      affiliateCode: 'DEMO',
      providerId,
      source: 'checkout',
      createdAt: ts(daysAgo(signupDay - 2)),
    });

    // Recurring invoices — 1 per month since
    for (let m = 1; m <= c.monthlyPayments; m++) {
      const invoiceDay = signupDay - m * 30;
      if (invoiceDay < 0) break;
      logs.push({
        id: `demo-log-${logId++}`,
        type: 'payment',
        amount: 1990,
        commission: RECURRING_COMMISSION_CENTS,
        commissionRate: 20,
        affiliateCode: 'DEMO',
        providerId,
        source: 'invoice',
        createdAt: ts(daysAgo(invoiceDay)),
      });
    }
  }

  // A handful of refunds for realism
  for (let i = 0; i < 3; i++) {
    logs.push({
      id: `demo-refund-${i}`,
      type: 'refund',
      amount: 1990,
      commission: RECURRING_COMMISSION_CENTS,
      affiliateCode: 'DEMO',
      providerId: `demo-provider-${50 + i}`,
      source: 'invoice',
      createdAt: ts(daysAgo(20 + i * 45)),
    });
  }

  // Sort desc by date — matches Firestore orderBy('createdAt', 'desc')
  logs.sort((a, b) => {
    const ta = a.createdAt?.toMillis() ?? 0;
    const tb = b.createdAt?.toMillis() ?? 0;
    return tb - ta;
  });

  return logs;
}

// ────────────────────────────────────────────────────────────────────────────
// Pre-aggregated demo data (mirrors what the Cloud Function triggers produce)
// ────────────────────────────────────────────────────────────────────────────

function monthKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Build the monthlyStats subcollection that the triggers would maintain. */
export function buildDemoMonthlyStats(): MonthlyStat[] {
  const logs = buildDemoLogs();
  const referrals = buildDemoReferrals();
  const map = new Map<string, MonthlyStat>();

  const ensure = (key: string): MonthlyStat => {
    let s = map.get(key);
    if (!s) {
      const [y, m] = key.split('-').map((n) => parseInt(n, 10));
      s = {
        monthKey: key,
        year: y,
        month: m,
        commissionGross: 0,
        commissionRefunds: 0,
        revenueGrossCents: 0,
        revenueRefundsCents: 0,
        paymentCount: 0,
        refundCount: 0,
        checkoutCount: 0,
        invoiceCount: 0,
        checkoutCommission: 0,
        invoiceCommission: 0,
        newReferrals: 0,
      };
      map.set(key, s);
    }
    return s;
  };

  for (const log of logs) {
    if (!log.createdAt?.toDate) continue;
    const key = monthKeyFor(log.createdAt.toDate());
    const s = ensure(key);
    if (log.type === 'refund') {
      s.commissionRefunds += log.commission ?? 0;
      s.revenueRefundsCents += log.amount ?? 0;
      s.refundCount += 1;
    } else {
      s.commissionGross += log.commission ?? 0;
      s.revenueGrossCents += log.amount ?? 0;
      s.paymentCount += 1;
      if (log.source === 'checkout') {
        s.checkoutCount += 1;
        s.checkoutCommission += log.commission ?? 0;
      } else if (log.source === 'invoice') {
        s.invoiceCount += 1;
        s.invoiceCommission += log.commission ?? 0;
      }
    }
  }

  for (const ref of referrals) {
    if (!ref.createdAt?.toDate) continue;
    const key = monthKeyFor(ref.createdAt.toDate());
    ensure(key).newReferrals += 1;
  }

  // Order by monthKey descending — matches the Firestore query in useAffiliate
  return Array.from(map.values()).sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));
}

/** Build the topReferrals subcollection — cumulative commission per provider. */
export function buildDemoTopReferrals(): TopReferralAggregate[] {
  const logs = buildDemoLogs();
  const referrals = buildDemoReferrals();
  const nameById = new Map(referrals.map((r) => [r.id, r.businessName]));

  const map = new Map<string, TopReferralAggregate>();
  for (const log of logs) {
    if (log.type !== 'payment' || !log.providerId) continue;
    let agg = map.get(log.providerId);
    if (!agg) {
      agg = {
        providerId: log.providerId,
        businessName: nameById.get(log.providerId) ?? null,
        totalCommission: 0,
        paymentCount: 0,
        firstPaymentAt: log.createdAt,
        lastPaymentAt: log.createdAt,
      };
      map.set(log.providerId, agg);
    }
    agg.totalCommission += log.commission ?? 0;
    agg.paymentCount += 1;
    if (log.createdAt && (!agg.firstPaymentAt || log.createdAt.toMillis() < agg.firstPaymentAt.toMillis())) {
      agg.firstPaymentAt = log.createdAt;
    }
    if (log.createdAt && (!agg.lastPaymentAt || log.createdAt.toMillis() > agg.lastPaymentAt.toMillis())) {
      agg.lastPaymentAt = log.createdAt;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalCommission - a.totalCommission)
    .slice(0, 5);
}
