import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/affiliates/verify?code=MARIE
 * Public endpoint — verifies an affiliate code and returns discount info
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json({ valid: false });
    }

    const db = getAdminFirestore();
    const snapshot = await db
      .collection('affiliates')
      .where('code', '==', code)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ valid: false });
    }

    const affiliate = snapshot.docs[0].data();
    const durationLabels: Record<string, string> = {
      once: 'le 1er mois',
      repeating_3: 'les 3 premiers mois',
      repeating_12: 'la 1ère année',
      forever: 'tous les mois',
    };

    return NextResponse.json({
      valid: true,
      affiliateId: snapshot.docs[0].id,
      affiliateName: affiliate.name,
      discount: affiliate.discount || null,
      discountDuration: affiliate.discountDuration || null,
      discountLabel: affiliate.discount
        ? `-${affiliate.discount}% sur ${durationLabels[affiliate.discountDuration] || 'le 1er mois'}`
        : null,
    });
  } catch (err: any) {
    console.error('[affiliates/verify] error:', err);
    return NextResponse.json({ valid: false });
  }
}

/**
 * POST /api/affiliates/verify
 * Register a new referral (increment trialReferrals)
 * Body: { code, providerId }
 */
export async function POST(request: NextRequest) {
  try {
    const { code, providerId } = await request.json();
    if (!code || !providerId) {
      return NextResponse.json({ error: 'code et providerId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const snapshot = await db
      .collection('affiliates')
      .where('code', '==', code.toUpperCase().trim())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 404 });
    }

    await db.collection('affiliates').doc(snapshot.docs[0].id).update({
      'stats.totalReferrals': FieldValue.increment(1),
      'stats.trialReferrals': FieldValue.increment(1),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[affiliates/verify] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
