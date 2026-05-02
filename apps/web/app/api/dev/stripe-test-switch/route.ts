import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe, getStripeDev } from '@/lib/stripe';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Dev-only swap tool for the Stripe IDs stored on a provider's
 * `subscription.stripeCustomerId` / `subscription.stripeSubscriptionId`.
 *
 * Used to flip between live and test Stripe envs without poking around
 * Firebase Console manually. Pure convenience — exposes nothing the
 * admin can't already do via the Firebase admin SDK.
 *
 * Endpoints:
 *  - GET    /api/dev/stripe-test-switch?providerId=...
 *      Returns the current values + a list of providers (slim) for the dropdown
 *  - POST   /api/dev/stripe-test-switch
 *      Body: { providerId, stripeCustomerId, stripeSubscriptionId }
 *      Updates Firestore + optionally validates each ID against both Stripe envs
 */

interface StripeIdValidation {
  found: boolean;
  env: 'live' | 'test' | null;
  error: string | null;
}

async function validateCustomer(id: string): Promise<StripeIdValidation> {
  if (!id) return { found: false, env: null, error: 'empty' };
  // Try test mode first (since dev usage)
  try {
    await getStripeDev().customers.retrieve(id);
    return { found: true, env: 'test', error: null };
  } catch {
    /* fall through */
  }
  try {
    await getStripe().customers.retrieve(id);
    return { found: true, env: 'live', error: null };
  } catch (e) {
    return {
      found: false,
      env: null,
      error: e instanceof Error ? e.message : 'unknown',
    };
  }
}

async function validateSubscription(id: string): Promise<StripeIdValidation> {
  if (!id) return { found: false, env: null, error: 'empty' };
  try {
    await getStripeDev().subscriptions.retrieve(id);
    return { found: true, env: 'test', error: null };
  } catch {
    /* fall through */
  }
  try {
    await getStripe().subscriptions.retrieve(id);
    return { found: true, env: 'live', error: null };
  } catch (e) {
    return {
      found: false,
      env: null,
      error: e instanceof Error ? e.message : 'unknown',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getAdminFirestore();
    const { searchParams } = request.nextUrl;
    const providerId = searchParams.get('providerId');

    // List endpoint — returns ONLY providers whose owner is an admin.
    // This intentionally narrows the dropdown to safe targets so a
    // careless click can't overwrite a real customer's Stripe IDs.
    if (!providerId) {
      const adminUsersSnap = await db
        .collection('users')
        .where('isAdmin', '==', true)
        .limit(50)
        .get();

      // Provider.id === User.id, so we can batch-fetch by uid.
      const adminUids = adminUsersSnap.docs
        .map((d) => d.id)
        // Keep only admins that also have a provider profile
        .filter((uid) => !!adminUsersSnap.docs.find((u) => u.id === uid)?.data().providerId);

      if (adminUids.length === 0) {
        return NextResponse.json({ providers: [] });
      }

      const providerRefs = adminUids.map((uid) => db.collection('providers').doc(uid));
      const providerDocs = await db.getAll(...providerRefs);

      const providers = providerDocs
        .filter((d) => d.exists)
        .map((d) => {
          const data = d.data()!;
          return {
            id: d.id,
            businessName: (data.businessName as string) ?? '(sans nom)',
            stripeCustomerId: (data.subscription?.stripeCustomerId as string | null) ?? null,
            stripeSubscriptionId:
              (data.subscription?.stripeSubscriptionId as string | null) ?? null,
            stripeConnectAccountId:
              (data.stripeConnectAccountId as string | null) ?? null,
          };
        })
        .sort((a, b) => a.businessName.localeCompare(b.businessName, 'fr'));
      return NextResponse.json({ providers });
    }

    // Single-provider read
    const docSnap = await db.collection('providers').doc(providerId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }
    const data = docSnap.data()!;
    return NextResponse.json({
      id: docSnap.id,
      businessName: (data.businessName as string) ?? '(sans nom)',
      stripeCustomerId: (data.subscription?.stripeCustomerId as string | null) ?? null,
      stripeSubscriptionId:
        (data.subscription?.stripeSubscriptionId as string | null) ?? null,
      stripeConnectAccountId: (data.stripeConnectAccountId as string | null) ?? null,
      stripeConnectStatus: (data.stripeConnectStatus as string | null) ?? null,
      depositsAddonActive: !!data.depositsAddonActive,
      plan: (data.plan as string) ?? null,
      subscriptionStatus: (data.subscription?.status as string | null) ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[DEV/stripe-test-switch GET] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, stripeCustomerId, stripeSubscriptionId, validate } = body as {
      providerId?: string;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      validate?: boolean;
    };

    if (!providerId) {
      return NextResponse.json({ error: 'providerId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection('providers').doc(providerId);
    const docSnap = await ref.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }

    // Optional pre-flight validation against Stripe (both envs)
    let validation:
      | { customer: StripeIdValidation; subscription: StripeIdValidation }
      | null = null;
    if (validate) {
      validation = {
        customer: await validateCustomer(stripeCustomerId ?? ''),
        subscription: await validateSubscription(stripeSubscriptionId ?? ''),
      };
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Use dot-notation so we don't clobber the rest of the subscription object
    if (stripeCustomerId !== undefined) {
      update['subscription.stripeCustomerId'] = stripeCustomerId || null;
    }
    if (stripeSubscriptionId !== undefined) {
      update['subscription.stripeSubscriptionId'] = stripeSubscriptionId || null;
    }

    await ref.update(update);

    return NextResponse.json({ ok: true, validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[DEV/stripe-test-switch POST] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
