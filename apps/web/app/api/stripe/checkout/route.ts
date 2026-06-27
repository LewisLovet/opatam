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
  // Referral code typed on the Abonnement page (for pros who did NOT enter a
  // code at signup). Validated server-side below.
  promoCode?: string;
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

    const { priceId, providerId, plan, trialDays, successUrl, cancelUrl, promoCode } = body;

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

    // Check if provider has an affiliate code + capture the remaining
    // free-trial end so we can honor it (see trial_end below).
    let affiliateCode: string | null = null;
    let affiliateId: string | null = null;
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;
    let trialValidUntil: Date | null = null;

    try {
      const providerDoc = await db.collection('providers').doc(providerId).get();
      if (providerDoc.exists) {
        const providerData = providerDoc.data();
        affiliateCode = providerData?.affiliateCode || null;
        affiliateId = providerData?.affiliateId || null;
        trialValidUntil = providerData?.subscription?.validUntil?.toDate?.() ?? null;

        // If affiliate exists, get the coupon
        if (affiliateId) {
          const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
          if (affiliateDoc.exists) {
            stripeCouponId = affiliateDoc.data()?.stripeCouponId || null;
          }
        }
      }

      // A code typed on the Abonnement page (pro who didn't enter one at
      // signup). Resolve it server-side — never trust a client-passed id — and
      // let it take precedence so the discount applies. We persist the link on
      // the provider doc so the webhook attributes the commission on BOTH the
      // first payment (metadata) AND every recurring invoice (provider doc).
      const typedCode = promoCode?.toUpperCase().trim();
      let typedMatchedAffiliate = false;
      if (typedCode) {
        const affSnap = await db
          .collection('affiliates')
          .where('code', '==', typedCode)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        if (!affSnap.empty) {
          typedMatchedAffiliate = true;
          const affDoc = affSnap.docs[0];
          const aff = affDoc.data();
          // Attribute the referral regardless of discount (commission still
          // applies); apply the coupon only when the affiliate has one.
          affiliateId = affDoc.id;
          affiliateCode = aff.code || typedCode;
          stripeCouponId = aff?.stripeCouponId || null;
          await db
            .collection('providers')
            .doc(providerId)
            .update({ affiliateCode, affiliateId, updatedAt: new Date() })
            .catch((e) => console.warn('[STRIPE-CHECKOUT] persist affiliate failed:', e));
        }
      }

      // Native Stripe promotion code (created directly in the Stripe dashboard,
      // not an affiliate). Only when the typed code isn't an affiliate code.
      // Takes precedence over any pre-existing affiliate coupon (it's what the
      // pro just typed). No commission is attributed for these.
      if (promoCode && !typedMatchedAffiliate) {
        const candidates = [...new Set([promoCode.trim(), promoCode.trim().toUpperCase()])];
        for (const c of candidates) {
          // active:true already filters out expired/maxed-out codes; Stripe
          // re-validates the promotion_code at checkout, so existence is enough.
          const promos = await stripe.promotionCodes.list({ code: c, active: true, limit: 1 });
          if (promos.data[0]) {
            stripePromotionCodeId = promos.data[0].id;
            break;
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

    // Trial handling: subscribing DURING the free trial must capture the
    // card now but charge only at the existing trial end (validUntil) —
    // the pro keeps their full free trial, no early charge.
    //   - explicit `trialDays` param wins (legacy/override),
    //   - else, if validUntil is far enough in the future (Stripe needs
    //     trial_end ≥ ~48h), charge exactly at validUntil,
    //   - else (trial over / almost over) → no trial, charge now.
    const nowSec = Math.floor(Date.now() / 1000);
    let trialEndUnix: number | null = null;
    if (trialValidUntil) {
      const vuSec = Math.floor(trialValidUntil.getTime() / 1000);
      if (vuSec > nowSec + 48 * 60 * 60) trialEndUnix = vuSec;
    }
    const subscriptionData: Record<string, unknown> = { metadata };
    if (typeof trialDays === 'number' && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    } else if (trialEndUnix) {
      subscriptionData.trial_end = trialEndUnix;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Codes are handled by our own validated field on the Abonnement page,
      // resolved server-side above and applied here via `discounts`:
      //   - affiliate code  → its coupon (+ commission attribution),
      //   - native Stripe promotion code → its promotion_code (no commission).
      // Stripe's native checkout promo field stays disabled when no code applies.
      allow_promotion_codes: stripeCouponId || stripePromotionCodeId ? undefined : false,
      ...(stripePromotionCodeId
        ? { discounts: [{ promotion_code: stripePromotionCodeId }] }
        : stripeCouponId
          ? { discounts: [{ coupon: stripeCouponId }] }
          : {}),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: subscriptionData as any,
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
