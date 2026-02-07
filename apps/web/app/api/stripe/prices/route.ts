import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';
import type Stripe from 'stripe';

type PlanKey = keyof typeof SUBSCRIPTION_PLANS;

interface FormattedPrice {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  trialDays?: number;
  plan: string | null;
  features: string[];
  planName: string | null;
  planDescription: string | null;
}

/** Sorting helpers */
const PLAN_ORDER: Record<string, number> = { solo: 0, team: 1, test: 2 };
const INTERVAL_ORDER: Record<string, number> = { month: 0, year: 1 };

export async function GET() {
  console.log('[STRIPE-PRICES] ========== START ==========');

  try {
    const stripe = getStripe();

    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product'],
    });

    console.log(`[STRIPE-PRICES] Found ${prices.data.length} active price(s)`);

    const formatted: FormattedPrice[] = prices.data.map((price) => {
      const product = price.product as Stripe.Product;
      const metadataPlan = product.metadata?.plan ?? null;

      // Match metadata.plan against SUBSCRIPTION_PLANS keys
      const matchedPlan =
        metadataPlan && metadataPlan in SUBSCRIPTION_PLANS
          ? (metadataPlan as PlanKey)
          : null;

      const localPlan = matchedPlan ? SUBSCRIPTION_PLANS[matchedPlan] : null;

      console.log(
        `[STRIPE-PRICES] Price ${price.id}: product="${product.name}", metadata.plan="${metadataPlan}", matched=${!!matchedPlan}`
      );

      return {
        id: price.id,
        productName: product.name ?? 'Produit sans nom',
        unitAmount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
        intervalCount: price.recurring?.interval_count ?? null,
        trialDays: price.recurring?.trial_period_days ?? undefined,
        plan: matchedPlan,
        features: localPlan ? [...localPlan.features] : [],
        planName: localPlan ? localPlan.name : null,
        planDescription: localPlan ? localPlan.description : null,
      };
    });

    // Sort: solo before team, then month before year
    formatted.sort((a, b) => {
      const planA = PLAN_ORDER[a.plan ?? ''] ?? 99;
      const planB = PLAN_ORDER[b.plan ?? ''] ?? 99;
      if (planA !== planB) return planA - planB;

      const intervalA = INTERVAL_ORDER[a.interval ?? ''] ?? 99;
      const intervalB = INTERVAL_ORDER[b.interval ?? ''] ?? 99;
      return intervalA - intervalB;
    });

    console.log('[STRIPE-PRICES] Formatted prices:', formatted.map((p) => `${p.planName ?? p.productName} (${p.id}) [${p.plan ?? 'no-plan'}/${p.interval ?? 'one-time'}]`));
    console.log('[STRIPE-PRICES] ========== END ==========');

    return NextResponse.json({ prices: formatted });
  } catch (error) {
    console.error('[STRIPE-PRICES] EXCEPTION:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
