import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: { providerId, ...(plan ? { plan } : {}) },
      },
      metadata: { providerId, ...(plan ? { plan } : {}) },
      success_url: successUrl
        ? `${process.env.NEXT_PUBLIC_APP_URL}${successUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`
        : `${process.env.NEXT_PUBLIC_APP_URL}/dev/tests/stripe?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl
        ? `${process.env.NEXT_PUBLIC_APP_URL}${cancelUrl}?cancelled=true`
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
