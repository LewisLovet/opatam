/**
 * Trigger: onAffiliateLogAggregate
 *
 * Maintains pre-computed aggregates so the affiliate dashboard never has
 * to scan the full `_affiliateLogs` collection at read-time. Two
 * subcollections under each affiliate are kept in sync:
 *
 *   affiliates/{affId}/monthlyStats/{YYYY-MM}
 *     Per-month totals (commissions, refunds, payment counts, split by
 *     checkout vs invoice). Used by the Statistiques charts.
 *
 *   affiliates/{affId}/topReferrals/{providerId}
 *     Cumulative commission per referred provider. Used by the Top 5 list.
 *
 * Fires on every write (create/update/delete) of `_affiliateLogs/{id}` and
 * uses FieldValue.increment with signed deltas, so the same log being
 * re-fired by Firestore won't double-count and a deletion correctly
 * reverses the previous values.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

interface LogShape {
  affiliateId?: string;
  providerId?: string;
  type?: 'payment' | 'refund';
  source?: 'checkout' | 'invoice' | string;
  amount?: number;
  commission?: number;
  createdAt?: Timestamp;
}

function monthKeyFromTimestamp(t: Timestamp | undefined | null): string | null {
  if (!t || typeof t.toDate !== 'function') return null;
  const d = t.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

interface MonthlyDelta {
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
}

const ZERO_DELTA: MonthlyDelta = {
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
};

/** Compute the monthly increment that this log contributes (positive). */
function logToDelta(log: LogShape): MonthlyDelta {
  const amount = log.amount ?? 0;
  const commission = log.commission ?? 0;
  const isRefund = log.type === 'refund';

  if (isRefund) {
    return {
      ...ZERO_DELTA,
      commissionRefunds: commission,
      revenueRefundsCents: amount,
      refundCount: 1,
    };
  }

  // Payment
  const isCheckout = log.source === 'checkout';
  const isInvoice = log.source === 'invoice';
  return {
    ...ZERO_DELTA,
    commissionGross: commission,
    revenueGrossCents: amount,
    paymentCount: 1,
    checkoutCount: isCheckout ? 1 : 0,
    invoiceCount: isInvoice ? 1 : 0,
    checkoutCommission: isCheckout ? commission : 0,
    invoiceCommission: isInvoice ? commission : 0,
  };
}

/** Subtract two deltas — used to compute "after - before" for the increment write. */
function diffDelta(after: MonthlyDelta, before: MonthlyDelta): MonthlyDelta {
  return {
    commissionGross: after.commissionGross - before.commissionGross,
    commissionRefunds: after.commissionRefunds - before.commissionRefunds,
    revenueGrossCents: after.revenueGrossCents - before.revenueGrossCents,
    revenueRefundsCents: after.revenueRefundsCents - before.revenueRefundsCents,
    paymentCount: after.paymentCount - before.paymentCount,
    refundCount: after.refundCount - before.refundCount,
    checkoutCount: after.checkoutCount - before.checkoutCount,
    invoiceCount: after.invoiceCount - before.invoiceCount,
    checkoutCommission: after.checkoutCommission - before.checkoutCommission,
    invoiceCommission: after.invoiceCommission - before.invoiceCommission,
  };
}

function isAllZero(d: MonthlyDelta): boolean {
  return (
    d.commissionGross === 0 &&
    d.commissionRefunds === 0 &&
    d.revenueGrossCents === 0 &&
    d.revenueRefundsCents === 0 &&
    d.paymentCount === 0 &&
    d.refundCount === 0 &&
    d.checkoutCount === 0 &&
    d.invoiceCount === 0 &&
    d.checkoutCommission === 0 &&
    d.invoiceCommission === 0
  );
}

async function applyMonthlyIncrement(
  db: admin.firestore.Firestore,
  affiliateId: string,
  monthKey: string,
  delta: MonthlyDelta,
): Promise<void> {
  if (isAllZero(delta)) return;

  const [year, month] = monthKey.split('-').map((s) => parseInt(s, 10));
  const ref = db.collection('affiliates').doc(affiliateId).collection('monthlyStats').doc(monthKey);

  await ref.set(
    {
      year,
      month,
      monthKey,
      commissionGross: FieldValue.increment(delta.commissionGross),
      commissionRefunds: FieldValue.increment(delta.commissionRefunds),
      revenueGrossCents: FieldValue.increment(delta.revenueGrossCents),
      revenueRefundsCents: FieldValue.increment(delta.revenueRefundsCents),
      paymentCount: FieldValue.increment(delta.paymentCount),
      refundCount: FieldValue.increment(delta.refundCount),
      checkoutCount: FieldValue.increment(delta.checkoutCount),
      invoiceCount: FieldValue.increment(delta.invoiceCount),
      checkoutCommission: FieldValue.increment(delta.checkoutCommission),
      invoiceCommission: FieldValue.increment(delta.invoiceCommission),
      updatedAt: new Date(),
    },
    { merge: true },
  );
}

async function applyTopReferralIncrement(
  db: admin.firestore.Firestore,
  affiliateId: string,
  providerId: string,
  commissionDelta: number,
  paymentCountDelta: number,
  paymentTimestamp: Timestamp | null,
): Promise<void> {
  if (commissionDelta === 0 && paymentCountDelta === 0) return;

  const ref = db
    .collection('affiliates')
    .doc(affiliateId)
    .collection('topReferrals')
    .doc(providerId);

  // Resolve businessName lazily — only on the first time we see this provider
  // (so we don't pay an extra read on every payment for the same one).
  const existing = await ref.get();
  let businessName = (existing.data()?.businessName as string | undefined) ?? null;
  if (!businessName) {
    try {
      const providerDoc = await db.collection('providers').doc(providerId).get();
      businessName = (providerDoc.data()?.businessName as string | undefined) ?? null;
    } catch {
      businessName = null;
    }
  }

  const update: Record<string, unknown> = {
    providerId,
    totalCommission: FieldValue.increment(commissionDelta),
    paymentCount: FieldValue.increment(paymentCountDelta),
    updatedAt: new Date(),
  };
  if (businessName) update.businessName = businessName;

  if (paymentTimestamp) {
    // lastPaymentAt = max(existing, new) — set unconditionally; firstPaymentAt only on first time
    update.lastPaymentAt = paymentTimestamp;
    if (!existing.exists || !existing.data()?.firstPaymentAt) {
      update.firstPaymentAt = paymentTimestamp;
    }
  }

  await ref.set(update, { merge: true });
}

export const onAffiliateLogAggregate = onDocumentWritten(
  {
    document: '_affiliateLogs/{logId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data() as LogShape | undefined;
    const after = event.data?.after?.data() as LogShape | undefined;

    const beforeAffId = before?.affiliateId;
    const afterAffId = after?.affiliateId;

    const db = admin.firestore();

    // Reverse the contribution of the previous version (if any)
    if (before && beforeAffId) {
      const beforeMonth = monthKeyFromTimestamp(before.createdAt);
      if (beforeMonth) {
        const negDelta = diffDelta(ZERO_DELTA, logToDelta(before));
        await applyMonthlyIncrement(db, beforeAffId, beforeMonth, negDelta);
      }
      // Top referrals reversal — only payments contribute
      if (before.providerId && before.type === 'payment') {
        await applyTopReferralIncrement(
          db,
          beforeAffId,
          before.providerId,
          -(before.commission ?? 0),
          -1,
          null, // we don't roll back lastPaymentAt — accept staleness
        );
      }
    }

    // Apply the contribution of the new version (if any)
    if (after && afterAffId) {
      const afterMonth = monthKeyFromTimestamp(after.createdAt);
      if (afterMonth) {
        await applyMonthlyIncrement(db, afterAffId, afterMonth, logToDelta(after));
      }
      // Top referrals — only payment contributions count toward the leaderboard
      if (after.providerId && after.type === 'payment') {
        await applyTopReferralIncrement(
          db,
          afterAffId,
          after.providerId,
          after.commission ?? 0,
          1,
          after.createdAt ?? null,
        );
      }
    }
  },
);
