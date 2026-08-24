import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET — les conversions payantes attribuées : les siennes, tout pour
 * manager/admin. C'est la matière du MRR attribué sur le tableau de bord —
 * et, demain, du calcul de commission.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  let query = db.collection('salesConversions').orderBy('firstPaidAt', 'desc').limit(200);
  if (auth.identity.role === 'sales') {
    query = db
      .collection('salesConversions')
      .where('staffUid', '==', auth.identity.uid)
      .orderBy('firstPaidAt', 'desc')
      .limit(200);
  }
  const snap = await query.get();
  return NextResponse.json({
    conversions: snap.docs.map((d) => {
      const x = d.data();
      return {
        providerId: d.id,
        staffUid: x.staffUid,
        businessName: x.businessName ?? null,
        plan: x.plan,
        source: x.source,
        mrrCents: x.mrrCents ?? 0,
        interval: x.interval ?? 'month',
        firstPaidAt: x.firstPaidAt?.toDate?.()?.toISOString() ?? null,
      };
    }),
  });
}
