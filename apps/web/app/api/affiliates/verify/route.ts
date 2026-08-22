import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { runAffiliateLink } from '@/lib/affiliate-link-tx';
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

    // Authentification OBLIGATOIRE : cette route écrit le rattachement
    // d'affiliation (réduction + attribution de commission). Sans jeton
    // vérifié, n'importe qui pouvait rattacher n'importe quel prestataire à
    // n'importe quel code.
    const authHeader = request.headers.get('authorization') ?? '';
    let authUid: string | null = null;
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
        authUid = decoded.uid;
      } catch {
        authUid = null; // jeton invalide/expiré → traité comme non authentifié
      }
    }

    const db = getAdminFirestore();
    const normalizedCode = String(code).toUpperCase().trim();
    const affiliateSnap = await db
      .collection('affiliates')
      .where('code', '==', normalizedCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    // Lecture du provider, contrôle « pas déjà rattaché », écriture du lien
    // et incrément des stats : UNE transaction (runAffiliateLink). Deux
    // requêtes simultanées ne peuvent plus rattacher deux fois ni compter
    // double — le perdant de la course ressort en alreadyLinked.
    const decision = await runAffiliateLink(db, {
      authUid,
      providerId,
      code: normalizedCode,
      affiliate: affiliateSnap.empty ? null : { id: affiliateSnap.docs[0].id },
    });

    if (!decision.ok) {
      return NextResponse.json({ error: decision.error }, { status: decision.status });
    }
    if (decision.alreadyLinked) {
      return NextResponse.json({ success: true, alreadyLinked: true });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[affiliates/verify] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
