import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripeDev } from '@/lib/stripe';

/**
 * POST /api/affiliates/onboarding
 * Generate a fresh Stripe Connect onboarding link for the authenticated affiliate
 * Body: { affiliateId }
 */
export async function POST(request: NextRequest) {
  try {
    const { affiliateId } = await request.json();
    if (!affiliateId) {
      return NextResponse.json({ error: 'affiliateId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const doc = await db.collection('affiliates').doc(affiliateId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Affilié non trouvé' }, { status: 404 });
    }

    const data = doc.data()!;
    const stripe = getStripeDev();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: data.stripeAccountId,
      refresh_url: `${baseUrl}/affiliation/dashboard`,
      return_url: `${baseUrl}/affiliation/dashboard`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error('[affiliates/onboarding] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
