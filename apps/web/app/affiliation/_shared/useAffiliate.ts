'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@booking-app/firebase';
import {
  buildDemoAffiliate,
  buildDemoLogs,
  buildDemoReferrals,
  buildDemoMonthlyStats,
  buildDemoTopReferrals,
} from './demoData';

export interface AffiliateData {
  id: string;
  name: string;
  email: string;
  code: string;
  commission: number;
  discount: number | null;
  discountDuration: string | null;
  stripeAccountId: string;
  stripeAccountStatus: string;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    trialReferrals: number;
    totalRevenue: number;
    totalCommission: number;
    linkClicks?: number;
  };
  createdAt?: Timestamp | null;
}

export interface LogEntry {
  id: string;
  type: 'payment' | 'refund';
  amount: number;
  commission: number;
  commissionRate?: number;
  affiliateCode: string;
  providerId?: string;
  source: string;
  createdAt: Timestamp | null;
}

export interface ReferralProvider {
  id: string;
  businessName: string;
  createdAt: Timestamp | null;
  subscription?: {
    plan?: string;
    status?: string;
  } | null;
}

/** Pre-aggregated per-month stats — see functions/src/triggers/onAffiliateLogAggregate.ts */
export interface MonthlyStat {
  monthKey: string; // "YYYY-MM"
  year: number;
  month: number; // 1-12
  commissionGross: number;
  commissionRefunds: number;
  revenueGrossCents: number;
  revenueRefundsCents: number;
  paymentCount: number;
  refundCount: number;
  checkoutCount: number;
  invoiceCount: number;
  checkoutCommission: number;
  invoiceCommission: number;
  newReferrals: number;
}

export interface TopReferralAggregate {
  providerId: string;
  businessName: string | null;
  totalCommission: number;
  paymentCount: number;
  firstPaymentAt: Timestamp | null;
  lastPaymentAt: Timestamp | null;
}

interface UseAffiliateOptions {
  /** Fetch the providers (referrals) list. Used by the donut on Statistiques. */
  includeReferrals?: boolean;
  /** Fetch the monthlyStats + topReferrals subcollections (Statistiques charts). */
  includeAggregates?: boolean;
  /** Limit the realtime logs query (Virements list). 0 disables the fetch. */
  logsLimit?: number;
}

/**
 * Shared data hook for all affiliate-space pages.
 *
 * - Subscribes to the affiliate doc in realtime
 * - Pulls only what the consuming page asked for, so:
 *   - Aperçu / Compte: just the affiliate doc
 *   - Virements: affiliate + last N logs
 *   - Statistiques: affiliate + monthlyStats + topReferrals + referrals
 */
export function useAffiliate(options: UseAffiliateOptions = {}) {
  const includeReferrals = options.includeReferrals ?? false;
  const includeAggregates = options.includeAggregates ?? false;
  const logsLimit = options.logsLimit ?? 50;

  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [referrals, setReferrals] = useState<ReferralProvider[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([]);
  const [topReferrals, setTopReferrals] = useState<TopReferralAggregate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo mode — inject synthetic data so the empty space can be previewed.
    // Enabled with ?demo=1 in the URL. Read-only, no Firestore hit.
    const demoMode =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('demo');
    if (demoMode) {
      setAffiliate(buildDemoAffiliate());
      if (logsLimit > 0) setLogs(buildDemoLogs().slice(0, logsLimit));
      if (includeReferrals) setReferrals(buildDemoReferrals());
      if (includeAggregates) {
        setMonthlyStats(buildDemoMonthlyStats());
        setTopReferrals(buildDemoTopReferrals());
      }
      setLoading(false);
      return;
    }

    let docUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAffiliate(null);
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const affiliateId = userDoc.data()?.affiliateId;
      if (!affiliateId) {
        setLoading(false);
        return;
      }

      // Realtime listener on the affiliate doc
      docUnsub = onSnapshot(doc(db, 'affiliates', affiliateId), (snap) => {
        if (snap.exists()) {
          setAffiliate({ id: snap.id, ...snap.data() } as AffiliateData);
        }
        setLoading(false);
      });

      // Logs — limited list for /virements (still raw)
      if (logsLimit > 0) {
        try {
          const logsQuery = query(
            collection(db, '_affiliateLogs'),
            where('affiliateId', '==', affiliateId),
            orderBy('createdAt', 'desc'),
            limit(logsLimit),
          );
          const logsSnap = await getDocs(logsQuery);
          setLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry)));
        } catch (err) {
          console.error('[useAffiliate] logs fetch error:', err);
        }
      }

      // Pre-aggregated monthlyStats + topReferrals — used by Statistiques.
      // ~13 + 5 reads max no matter how old the affiliate's account is.
      if (includeAggregates) {
        try {
          const monthlyQuery = query(
            collection(db, 'affiliates', affiliateId, 'monthlyStats'),
            orderBy('monthKey', 'desc'),
            limit(13),
          );
          const monthlySnap = await getDocs(monthlyQuery);
          setMonthlyStats(
            monthlySnap.docs.map((d) => ({
              monthKey: d.id,
              ...(d.data() as Omit<MonthlyStat, 'monthKey'>),
            })),
          );
        } catch (err) {
          console.error('[useAffiliate] monthlyStats fetch error:', err);
        }

        try {
          const topQuery = query(
            collection(db, 'affiliates', affiliateId, 'topReferrals'),
            orderBy('totalCommission', 'desc'),
            limit(5),
          );
          const topSnap = await getDocs(topQuery);
          setTopReferrals(
            topSnap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                providerId: d.id,
                businessName: (data.businessName as string | null) ?? null,
                totalCommission: (data.totalCommission as number) ?? 0,
                paymentCount: (data.paymentCount as number) ?? 0,
                firstPaymentAt: (data.firstPaymentAt as Timestamp | null) ?? null,
                lastPaymentAt: (data.lastPaymentAt as Timestamp | null) ?? null,
              };
            }),
          );
        } catch (err) {
          console.error('[useAffiliate] topReferrals fetch error:', err);
        }
      }

      // Referrals — only used by the donut chart for current status distribution.
      // Could later be replaced by explicit canceled/active counters on the
      // affiliate doc, but for now a single capped query is acceptable.
      if (includeReferrals) {
        try {
          const providersQuery = query(
            collection(db, 'providers'),
            where('affiliateId', '==', affiliateId),
            orderBy('createdAt', 'desc'),
            limit(500),
          );
          const providersSnap = await getDocs(providersQuery);
          setReferrals(
            providersSnap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                businessName: (data.businessName as string) || '—',
                createdAt: (data.createdAt as Timestamp) ?? null,
                subscription: (data.subscription as ReferralProvider['subscription']) ?? null,
              };
            }),
          );
        } catch (err) {
          console.error('[useAffiliate] referrals fetch error:', err);
        }
      }
    });

    return () => {
      authUnsub();
      if (docUnsub) docUnsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { affiliate, logs, referrals, monthlyStats, topReferrals, loading };
}
