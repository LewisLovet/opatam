/**
 * Trigger: onProviderReferralAggregate
 *
 * Maintains the `newReferrals` per-month counter on the affiliate's
 * monthlyStats subcollection so the "Nouveaux filleuls par mois" chart
 * doesn't have to scan the providers collection.
 *
 *   affiliates/{affId}/monthlyStats/{YYYY-MM}.newReferrals
 *
 * Fires on writes to providers/{providerId}. Increment on creation if
 * the provider has an affiliateId, decrement on deletion. Updates that
 * don't change the affiliate are ignored.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

interface ProviderShape {
  affiliateId?: string | null;
  createdAt?: Timestamp;
}

function monthKeyFromTimestamp(t: Timestamp | undefined | null): string | null {
  if (!t || typeof t.toDate !== 'function') return null;
  const d = t.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function bumpNewReferrals(
  db: admin.firestore.Firestore,
  affiliateId: string,
  monthKey: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const [year, month] = monthKey.split('-').map((s) => parseInt(s, 10));
  const ref = db.collection('affiliates').doc(affiliateId).collection('monthlyStats').doc(monthKey);
  await ref.set(
    {
      year,
      month,
      monthKey,
      newReferrals: FieldValue.increment(delta),
      updatedAt: new Date(),
    },
    { merge: true },
  );
}

export const onProviderReferralAggregate = onDocumentWritten(
  {
    document: 'providers/{providerId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data() as ProviderShape | undefined;
    const after = event.data?.after?.data() as ProviderShape | undefined;

    const beforeAffId = before?.affiliateId ?? null;
    const afterAffId = after?.affiliateId ?? null;

    const db = admin.firestore();

    // Provider deleted (or affiliateId removed) — decrement on the original month
    if (beforeAffId && (!after || beforeAffId !== afterAffId)) {
      const month = monthKeyFromTimestamp(before?.createdAt);
      if (month) {
        await bumpNewReferrals(db, beforeAffId, month, -1);
      }
    }

    // Provider created (or affiliateId added) — increment on the createdAt month
    if (afterAffId && (!before || beforeAffId !== afterAffId)) {
      const month = monthKeyFromTimestamp(after?.createdAt);
      if (month) {
        await bumpNewReferrals(db, afterAffId, month, 1);
      }
    }
  },
);
