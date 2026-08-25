import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

/**
 * GET ?code= — un code promotionnel Stripe natif est-il valable ?
 *
 * Repli de la page Abonnement : le champ code vérifie d'abord les codes
 * d'affiliation ; si ce n'en est pas un, ce point vérifie les Promotion
 * Codes Stripe (dont les offres commerciales OPA-…). Ne renvoie que le
 * LIBELLÉ de la remise — jamais d'identifiant interne : le checkout
 * re-résout le code côté serveur, rien de client n'est cru.
 */
export async function GET(request: NextRequest) {
  const brut = request.nextUrl.searchParams.get('code')?.trim();
  if (!brut) return NextResponse.json({ valid: false });

  try {
    const stripe = getStripe();
    const candidats = [...new Set([brut, brut.toUpperCase()])];
    for (const c of candidats) {
      const promos = await stripe.promotionCodes.list({ code: c, active: true, limit: 1 });
      const promo = promos.data[0];
      // Deux formats selon la version d'API : la nôtre (2025-04-30) renvoie
      // l'ANCIEN — `promo.coupon`, coupon complet embarqué (les typages v20
      // du SDK décrivent le nouveau, d'où le passage par unknown). Le nouveau
      // format (`promo.promotion.coupon`) est lu en repli, id résolu au
      // besoin — le jour où l'épingle de version bouge, rien ne casse.
      const ancien = (promo as unknown as { coupon?: unknown })?.coupon;
      const brut = ancien ?? promo?.promotion?.coupon;
      const coupon = (
        typeof brut === 'string' ? await stripe.coupons.retrieve(brut) : brut
      ) as { percent_off?: number | null; duration?: string; duration_in_months?: number | null; name?: string | null } | null | undefined;
      if (coupon && typeof coupon !== 'string') {
        const pct = coupon.percent_off;
        const duree =
          coupon.duration === 'repeating' && coupon.duration_in_months
            ? ` pendant ${coupon.duration_in_months} mois`
            : coupon.duration === 'once'
              ? ' (une fois)'
              : '';
        return NextResponse.json({
          valid: true,
          discountLabel: pct ? `−${pct} %${duree}` : (coupon.name ?? 'Remise'),
          discount: pct ?? null,
          discountDuration: coupon.duration ?? null,
        });
      }
    }
  } catch (e) {
    console.warn('[promo-verify] vérification échouée:', e);
  }
  return NextResponse.json({ valid: false });
}
