import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getStripeDev } from '@/lib/stripe';
import type Stripe from 'stripe';

/**
 * GET /api/dev/stripe-test-switch/browse?env=test|live
 *
 * Returns the most recent customers (with their subscriptions) from the
 * specified Stripe environment. Used by the swap tool to let the dev
 * pick the right IDs in 1 click instead of copy/pasting from the Stripe
 * dashboard.
 *
 * Defaults to test mode since that's the typical dev usage.
 */
export async function GET(request: NextRequest) {
  try {
    const env = (request.nextUrl.searchParams.get('env') ?? 'test') as 'test' | 'live';
    const stripe = env === 'live' ? getStripe() : getStripeDev();

    // Pull recent customers (we cap at 25 — more is rarely useful in dev)
    const customers = await stripe.customers.list({ limit: 25 });

    // For each customer, pull their active subscriptions in parallel
    const enriched = await Promise.all(
      customers.data.map(async (c) => {
        let subs: Stripe.Subscription[] = [];
        try {
          const list = await stripe.subscriptions.list({
            customer: c.id,
            status: 'all',
            limit: 5,
          });
          subs = list.data;
        } catch {
          // Customer may not allow listing subs in some edge cases — silent skip
        }

        return {
          id: c.id,
          email: c.email ?? null,
          name: c.name ?? null,
          createdAt: c.created,
          subscriptions: subs.map((s) => ({
            id: s.id,
            status: s.status,
            // Each sub item lists the product/price — we surface the first as a label
            label:
              s.items.data
                .map((it) => {
                  const price = it.price;
                  const amount = price.unit_amount
                    ? `${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`
                    : '';
                  const interval = price.recurring?.interval ?? '';
                  return `${amount}${interval ? ` / ${interval}` : ''}`;
                })
                .filter(Boolean)
                .join(' + ') || '(no items)',
          })),
        };
      })
    );

    // Sort: customers with subs first, then by createdAt desc
    enriched.sort((a, b) => {
      const subDiff = b.subscriptions.length - a.subscriptions.length;
      if (subDiff !== 0) return subDiff;
      return b.createdAt - a.createdAt;
    });

    return NextResponse.json({ env, customers: enriched });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[DEV/stripe-test-switch/browse] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
