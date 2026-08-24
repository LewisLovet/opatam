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
  // Égalité seule + tri en mémoire — pas d'index composite à déployer.
  const query =
    auth.identity.role === 'sales'
      ? db.collection('salesConversions').where('staffUid', '==', auth.identity.uid).limit(500)
      : db.collection('salesConversions').limit(500);
  const snap = await query.get();
  return NextResponse.json({
    conversions: snap.docs.sort((a, b) => {
      const ta = a.data().firstPaidAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.data().firstPaidAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    }).map((d) => {
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
