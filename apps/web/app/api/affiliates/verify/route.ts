import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripe } from '@/lib/stripe';

/**
 * GET /api/affiliates/verify?code=MARIE
 * Public endpoint — verifies an affiliate code and returns discount info
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('code')?.trim();
    const code = raw?.toUpperCase();

    if (!raw || !code) {
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
      // Not an affiliate code → fall back to a native Stripe promotion code
      // (one created directly in the Stripe dashboard). No commission.
      return await verifyStripePromotionCode(raw);
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
 * Fallback for the GET verify: resolve a native Stripe Promotion Code (created
 * directly in the Stripe dashboard, not tied to an affiliate). Returns the same
 * shape as an affiliate so the Abonnement page renders the discount and applies
 * it at checkout. Case-insensitive lookup (Stripe's `code` filter is exact).
 */
async function verifyStripePromotionCode(raw: string): Promise<NextResponse> {
  try {
    const stripe = getStripe();
    const candidates = [...new Set([raw, raw.toUpperCase()])];
    for (const c of candidates) {
      const promos = await stripe.promotionCodes.list({ code: c, active: true, limit: 1 });
      const promo = promos.data[0] as unknown as
        | { coupon?: string | { id?: string }; promotion?: { coupon?: string } }
        | undefined;
      if (!promo) continue;
      // The coupon reference moved across API versions: top-level `coupon`
      // (object or id) on older ones, `promotion.coupon` (id) on newer ones.
      const couponId =
        (typeof promo.coupon === 'string' && promo.coupon) ||
        (promo.coupon && typeof promo.coupon === 'object' ? promo.coupon.id : undefined) ||
        promo.promotion?.coupon ||
        undefined;
      if (!couponId) continue;
      const coupon = await stripe.coupons.retrieve(couponId);
      if (!coupon.valid) continue;

      const amountTxt = coupon.percent_off
        ? `-${coupon.percent_off}%`
        : coupon.amount_off
          ? `-${(coupon.amount_off / 100).toFixed(2)} ${(coupon.currency || 'eur').toUpperCase()}`
          : 'Réduction';
      const durationTxt =
        coupon.duration === 'forever'
          ? 'tous les mois'
          : coupon.duration === 'repeating'
            ? `les ${coupon.duration_in_months} premiers mois`
            : 'le 1er mois';

      // Map to the affiliate-style duration keys the plan cards understand
      // (so the strikethrough price preview works for percent coupons).
      let discountDuration: string | null = null;
      if (coupon.duration === 'once') discountDuration = 'once';
      else if (coupon.duration === 'forever') discountDuration = 'forever';
      else if (coupon.duration === 'repeating')
        discountDuration =
          coupon.duration_in_months === 3
            ? 'repeating_3'
            : coupon.duration_in_months === 12
              ? 'repeating_12'
              : null;

      return NextResponse.json({
        valid: true,
        kind: 'stripe',
        discount: coupon.percent_off ?? null,
        discountDuration,
        discountLabel: `${amountTxt} sur ${durationTxt}`,
      });
    }
  } catch (err) {
    console.error('[affiliates/verify] Stripe promo lookup error:', err);
  }
  return NextResponse.json({ valid: false });
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
