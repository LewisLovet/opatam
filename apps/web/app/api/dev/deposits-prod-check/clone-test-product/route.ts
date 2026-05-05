/**
 * POST /api/dev/deposits-prod-check/clone-test-product
 *
 * Convenience for the dev tool: copies the LIVE Sérénité product
 * (the one whose `metadata.addon = "deposits"` is set) into Stripe
 * TEST mode so local end-to-end testing works without manually
 * recreating it.
 *
 * Idempotent — if a TEST product already exists with
 * `metadata.addon = "deposits"`, returns it as-is.
 *
 * Pure write to Stripe TEST. Never touches LIVE.
 */

import { NextResponse } from 'next/server';
import { getStripe, getStripeDev, getAddonPriceId } from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST() {
  const stripeLive = getStripe();
  const stripeTest = getStripeDev();

  // 1. Already exists in TEST? Bail out idempotently.
  try {
    const existingId = await getAddonPriceId('deposits', stripeTest);
    const existing = await stripeTest.prices.retrieve(existingId, {
      expand: ['product'],
    });
    return NextResponse.json({
      created: false,
      reason: 'already_exists',
      product: (existing.product as Stripe.Product).id,
      price: existing.id,
    });
  } catch {
    // Not found in TEST — proceed to clone.
  }

  // 2. Read the LIVE source.
  const liveId = await getAddonPriceId('deposits', stripeLive);
  const livePrice = await stripeLive.prices.retrieve(liveId, {
    expand: ['product'],
  });
  const liveProduct = livePrice.product as Stripe.Product;

  // 3. Recreate in TEST. Metadata is the only thing the helper
  //    actually uses; we copy name/description/etc. for fidelity.
  const testProduct = await stripeTest.products.create({
    name: liveProduct.name,
    description: liveProduct.description ?? undefined,
    statement_descriptor: liveProduct.statement_descriptor ?? undefined,
    metadata: liveProduct.metadata,
    tax_code: liveProduct.tax_code as string | undefined,
  });

  const testPrice = await stripeTest.prices.create({
    product: testProduct.id,
    unit_amount: livePrice.unit_amount ?? 500,
    currency: livePrice.currency,
    recurring: livePrice.recurring
      ? {
          interval: livePrice.recurring.interval,
          interval_count: livePrice.recurring.interval_count,
        }
      : undefined,
    tax_behavior: livePrice.tax_behavior ?? undefined,
  });

  return NextResponse.json({
    created: true,
    product: testProduct.id,
    price: testPrice.id,
  });
}
