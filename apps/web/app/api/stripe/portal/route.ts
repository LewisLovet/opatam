import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

interface PortalRequest {
  customerId: string;
  returnUrl?: string;
}

export async function POST(request: NextRequest) {
  console.log('[STRIPE-PORTAL] ========== START ==========');

  try {
    const body: PortalRequest = await request.json();
    console.log('[STRIPE-PORTAL] Request body received:', {
      customerId: body.customerId,
      returnUrl: body.returnUrl ?? 'NOT PROVIDED',
    });

    const { customerId, returnUrl } = body;

    // Validate required fields
    if (!customerId) {
      console.log('[STRIPE-PORTAL] ERROR: Missing required fields');
      return NextResponse.json(
        { message: 'customerId is required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pro/parametres?tab=abonnement`,
    });

    console.log('[STRIPE-PORTAL] SUCCESS - Portal session created');
    console.log('[STRIPE-PORTAL] ========== END ==========');
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('[STRIPE-PORTAL] EXCEPTION:', error);

    if (error?.type === 'StripeInvalidRequestError' && error?.code === 'resource_missing') {
      return NextResponse.json(
        { message: 'Client Stripe introuvable. Votre compte a peut-être été créé dans un autre environnement (test/production). Veuillez re-souscrire.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
