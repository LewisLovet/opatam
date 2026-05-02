import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getStripeDev } from '@/lib/stripe';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import type Stripe from 'stripe';

/**
 * GET /api/dev/stripe-test-switch/recover-from-email
 *   ?providerId=xxx&env=live|test
 *
 * Recovery tool for "oops, I overwrote the wrong provider's Stripe IDs".
 *
 * Resolution chain:
 *   1. providerId → users/{providerId}.email + Firebase Auth fallback
 *   2. Stripe.customers.list({ email }) in the requested env
 *   3. For each matching customer, list their subscriptions
 *
 * The endpoint NEVER writes to Firestore — the dev decides which match
 * to apply via the existing POST /api/dev/stripe-test-switch.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const providerId = searchParams.get('providerId');
    const env = (searchParams.get('env') ?? 'live') as 'live' | 'test';

    if (!providerId) {
      return NextResponse.json({ error: 'providerId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(providerId).get();
    let email: string | null = null;
    let displayName: string | null = null;

    if (userSnap.exists) {
      email = (userSnap.data()?.email as string | null) ?? null;
      displayName = (userSnap.data()?.displayName as string | null) ?? null;
    }

    // Fallback: Firebase Auth (in case the users doc is missing the email)
    if (!email) {
      try {
        const authUser = await getAdminAuth().getUser(providerId);
        email = authUser.email ?? null;
        displayName = displayName ?? authUser.displayName ?? null;
      } catch {
        // ignore — surface a clear error below
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Aucun email trouvé pour cet uid (ni dans users ni dans Firebase Auth)' },
        { status: 404 }
      );
    }

    const stripe = env === 'live' ? getStripe() : getStripeDev();
    const customers = await stripe.customers.list({ email, limit: 10 });

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
          /* silent skip */
        }
        return {
          id: c.id,
          email: c.email ?? null,
          name: c.name ?? null,
          createdAt: c.created,
          subscriptions: subs.map((s) => ({
            id: s.id,
            status: s.status,
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

    // Sort: customers with subs first
    enriched.sort((a, b) => b.subscriptions.length - a.subscriptions.length);

    return NextResponse.json({
      env,
      email,
      displayName,
      customers: enriched,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[DEV/stripe-test-switch/recover-from-email] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
