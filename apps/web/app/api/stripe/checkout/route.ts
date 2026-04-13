import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';

interface CheckoutRequest {
  priceId: string;
  providerId: string;
  plan?: string;
  trialDays?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export async function POST(request: NextRequest) {
  console.log('[STRIPE-CHECKOUT] ========== START ==========');

  try {
    const body: CheckoutRequest = await request.json();
    console.log('[STRIPE-CHECKOUT] Request body received:', {
      priceId: body.priceId,
      providerId: body.providerId,
      plan: body.plan ?? 'NOT PROVIDED',
      trialDays: body.trialDays ?? 'NOT PROVIDED',
    });

    const { priceId, providerId, plan, trialDays, successUrl, cancelUrl } = body;

    // Validate required fields
    if (!priceId || !providerId) {
      console.log('[STRIPE-CHECKOUT] ERROR: Missing required fields');
      return NextResponse.json(
        { message: 'priceId and providerId are required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const db = getAdminFirestore();

    // Check if provider has an affiliate code
    let affiliateCode: string | null = null;
    let affiliateId: string | null = null;
    let stripeCouponId: string | null = null;

    try {
      const providerDoc = await db.collection('providers').doc(providerId).get();
      if (providerDoc.exists) {
        const providerData = providerDoc.data();
        affiliateCode = providerData?.affiliateCode || null;
        affiliateId = providerData?.affiliateId || null;

        // If affiliate exists, get the coupon
        if (affiliateId) {
          const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
          if (affiliateDoc.exists) {
            stripeCouponId = affiliateDoc.data()?.stripeCouponId || null;
          }
        }
      }
    } catch (err) {
      console.warn('[STRIPE-CHECKOUT] Could not fetch affiliate info:', err);
    }

    const metadata = {
      providerId,
      ...(plan ? { plan } : {}),
      ...(affiliateCode ? { affiliateCode } : {}),
      ...(affiliateId ? { affiliateId } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: stripeCouponId ? undefined : true, // Disable promo codes if affiliate coupon applied
      ...(stripeCouponId ? { discounts: [{ coupon: stripeCouponId }] } : {}),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata,
      },
      metadata,
      success_url: successUrl
        ? `${process.env.NEXT_PUBLIC_APP_URL}${successUrl}${successUrl.includes('?') ? '&' : '?'}success=true&session_id={CHECKOUT_SESSION_ID}`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dev/tests/stripe?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl
        ? `${process.env.NEXT_PUBLIC_APP_URL}${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}cancelled=true`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dev/tests/stripe?cancelled=true`,
    });

    console.log('[STRIPE-CHECKOUT] SUCCESS - Session created:', session.id);
    console.log('[STRIPE-CHECKOUT] ========== END ==========');
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[STRIPE-CHECKOUT] EXCEPTION:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
