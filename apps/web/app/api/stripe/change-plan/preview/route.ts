import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/stripe/change-plan/preview
 *
 * Computes a preview of what would happen if the user switched to the
 * given price. No side effects — purely a read that Stripe resolves
 * against the current subscription's proration rules.
 *
 * Body: { subscriptionId, newPriceId }
 *
 * Returns:
 * {
 *   currentPrice: { id, plan, unitAmount, interval }        // the item being replaced
 *   newPrice:     { id, plan, unitAmount, interval }        // the target
 *   creditCents:      negative total of the "unused time" lines (always <= 0)
 *   chargeCents:      positive total of the "remaining time" lines on new plan
 *   netCents:         creditCents + chargeCents (signed)
 *   currency:         "eur"
 *   nextInvoiceDate:  ISO string — when the net amount is actually billed
 *   isUpgrade:        boolean — true if netCents > 0 (charged), false if <= 0 (credit)
 * }
 */
interface PreviewRequest {
  subscriptionId: string;
  newPriceId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId, newPriceId } = (await request.json()) as PreviewRequest;

    if (!subscriptionId || !newPriceId) {
      return NextResponse.json(
        { message: 'subscriptionId et newPriceId sont requis' },
        { status: 400 },
      );
    }

    const stripe = getStripe();

    // Load current subscription to find the item being replaced
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription || subscription.status === 'canceled') {
      return NextResponse.json(
        { message: 'Abonnement introuvable ou annulé' },
        { status: 400 },
      );
    }

    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      return NextResponse.json(
        { message: "Aucun élément d'abonnement trouvé" },
        { status: 400 },
      );
    }

    // Ask Stripe to simulate the next invoice AS IF the item had already
    // been swapped — this is the source of truth for proration amounts.
    const preview = await stripe.invoices.createPreview({
      subscription: subscriptionId,
      subscription_details: {
        items: [{ id: currentItem.id, price: newPriceId }],
        proration_behavior: 'create_prorations',
      },
    });

    // Split the preview lines into credits (negative proration items from the
    // old price) and charges (new price lines). In the 2025-04-30 API the
    // proration flag lives under `parent.{invoice_item_details|subscription_item_details}.proration`.
    let creditCents = 0;
    let chargeCents = 0;
    for (const line of preview.lines.data) {
      const amount = line.amount ?? 0;
      const parent = line.parent;
      const isProration =
        parent?.type === 'invoice_item_details'
          ? parent.invoice_item_details?.proration === true
          : parent?.type === 'subscription_item_details'
            ? parent.subscription_item_details?.proration === true
            : false;
      if (isProration) {
        if (amount < 0) {
          creditCents += amount;
        } else {
          chargeCents += amount;
        }
      }
    }

    const netCents = creditCents + chargeCents;

    // Resolve the next invoice date — Stripe exposes it via
    // subscription.current_period_end (subscription item in newer API).
    // We use the existing helper that already exists in the webhook.
    const itemPeriodEnd =
      (currentItem as unknown as { current_period_end?: number })
        .current_period_end ?? null;
    const subPeriodEnd =
      (subscription as unknown as { current_period_end?: number })
        .current_period_end ?? null;
    const periodEndSec = itemPeriodEnd ?? subPeriodEnd;
    const nextInvoiceDate = periodEndSec
      ? new Date(periodEndSec * 1000).toISOString()
      : null;

    // Extract current and new price info for display (plan name + amount)
    const currentPriceInfo = {
      id: currentItem.price.id,
      plan: (subscription.metadata?.plan as string | undefined) ?? null,
      unitAmount: currentItem.price.unit_amount ?? 0,
      interval: currentItem.price.recurring?.interval ?? null,
    };

    const newPriceObj = await stripe.prices.retrieve(newPriceId, {
      expand: ['product'],
    });
    const newProduct = newPriceObj.product as Stripe.Product;
    const newPriceInfo = {
      id: newPriceObj.id,
      plan: (newProduct.metadata?.plan as string | undefined) ?? null,
      unitAmount: newPriceObj.unit_amount ?? 0,
      interval: newPriceObj.recurring?.interval ?? null,
    };

    return NextResponse.json({
      currentPrice: currentPriceInfo,
      newPrice: newPriceInfo,
      creditCents,
      chargeCents,
      netCents,
      currency: preview.currency,
      nextInvoiceDate,
      isUpgrade: netCents > 0,
    });
  } catch (error: unknown) {
    console.error('[STRIPE-CHANGE-PLAN-PREVIEW] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ message }, { status: 500 });
  }
}
