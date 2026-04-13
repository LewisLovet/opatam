import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_DEV || process.env.STRIPE_SECRET_KEY!);

/**
 * GET /api/dev/affiliates — List all affiliates
 */
export async function GET() {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('affiliates').orderBy('createdAt', 'desc').get();
    const affiliates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));

    // Also fetch logs
    const logsSnapshot = await db.collection('_affiliateLogs').orderBy('createdAt', 'desc').limit(50).get();
    const logs = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    }));

    return NextResponse.json({ affiliates, logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/dev/affiliates — Create affiliate + Stripe Connect account
 * Body: { name, email, code, commission }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, code, commission = 20 } = body;

    if (!name || !email || !code) {
      return NextResponse.json({ error: 'name, email et code sont requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const normalizedCode = code.toUpperCase().trim();

    // Check code uniqueness
    const existing = await db.collection('affiliates').where('code', '==', normalizedCode).get();
    if (!existing.empty) {
      return NextResponse.json({ error: `Le code "${normalizedCode}" existe déjà` }, { status: 409 });
    }

    // Create account token first (required for FR platforms)
    const accountToken = await stripe.tokens.create({
      account: {
        business_type: 'individual',
        individual: {
          first_name: name.split(' ')[0] || 'Test',
          last_name: name.split(' ').slice(1).join(' ') || 'Affiliate',
          email,
          dob: { day: 1, month: 1, year: 1990 },
          address: {
            line1: '1 Rue de Test',
            city: 'Paris',
            postal_code: '75001',
            country: 'FR',
          },
        },
        tos_shown_and_accepted: true,
      },
    });

    // Create Stripe Connect Custom account with token
    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'FR',
      email,
      account_token: accountToken.id,
      capabilities: {
        transfers: { requested: true },
      },
      external_account: {
        object: 'bank_account',
        country: 'FR',
        currency: 'eur',
        account_number: 'FR1420041010050500013M02606', // Stripe test IBAN
      },
      metadata: {
        affiliateCode: normalizedCode,
        affiliateName: name,
      },
    });

    // Check capabilities status
    const retrieved = await stripe.accounts.retrieve(account.id);
    const transfersStatus = retrieved.capabilities?.transfers || 'not_requested';
    console.log(`[affiliates] Account ${account.id} transfers capability: ${transfersStatus}`);

    // Generate onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/dev/tools/affiliates?refresh=true`,
      return_url: `${baseUrl}/dev/tools/affiliates?onboarded=${account.id}`,
      type: 'account_onboarding',
    });

    // Save to Firestore
    const affiliateData = {
      name,
      email,
      code: normalizedCode,
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending',
      commission: Number(commission),
      stats: {
        totalReferrals: 0,
        totalRevenue: 0,
        totalCommission: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('affiliates').add(affiliateData);

    return NextResponse.json({
      success: true,
      affiliate: { id: docRef.id, ...affiliateData },
      onboardingUrl: accountLink.url,
      stripeAccount: {
        id: account.id,
        capabilities: retrieved.capabilities,
        chargesEnabled: retrieved.charges_enabled,
        payoutsEnabled: retrieved.payouts_enabled,
      },
    });
  } catch (err: any) {
    console.error('[dev/affiliates] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/dev/affiliates — Check & update Stripe account status
 * Body: { affiliateId }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { affiliateId } = body;

    if (!affiliateId) {
      return NextResponse.json({ error: 'affiliateId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const docRef = db.collection('affiliates').doc(affiliateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Affilié non trouvé' }, { status: 404 });
    }

    const data = doc.data()!;
    const account = await stripe.accounts.retrieve(data.stripeAccountId);

    const transfersStatus = account.capabilities?.transfers || 'not_requested';
    const newStatus = transfersStatus === 'active' ? 'active' : transfersStatus === 'pending' ? 'pending' : 'restricted';

    await docRef.update({
      stripeAccountStatus: newStatus,
      updatedAt: new Date(),
    });

    // Generate new onboarding link if not fully active
    let onboardingUrl = null;
    if (newStatus !== 'active') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const accountLink = await stripe.accountLinks.create({
        account: data.stripeAccountId,
        refresh_url: `${baseUrl}/dev/tools/affiliates?refresh=true`,
        return_url: `${baseUrl}/dev/tools/affiliates?onboarded=${data.stripeAccountId}`,
        type: 'account_onboarding',
      });
      onboardingUrl = accountLink.url;
    }

    return NextResponse.json({
      success: true,
      stripeAccountId: account.id,
      capabilities: account.capabilities,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      transfersStatus,
      status: newStatus,
      onboardingUrl,
    });
  } catch (err: any) {
    console.error('[dev/affiliates] PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/dev/affiliates — Delete affiliate(s)
 * Body: { affiliateId } or { all: true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { affiliateId, all } = body;
    const db = getAdminFirestore();

    if (all) {
      // Delete all affiliates
      const snapshot = await db.collection('affiliates').get();
      const batch = db.batch();
      const deletePromises: Promise<any>[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        // Delete Stripe Connect account
        if (data.stripeAccountId) {
          deletePromises.push(
            stripe.accounts.del(data.stripeAccountId).catch((e) => {
              console.warn(`Failed to delete Stripe account ${data.stripeAccountId}:`, e.message);
            })
          );
        }
        batch.delete(doc.ref);
      }

      await Promise.all(deletePromises);
      await batch.commit();

      // Delete simulation logs
      const logsSnapshot = await db.collection('_affiliateLogs').get();
      if (!logsSnapshot.empty) {
        const logsBatch = db.batch();
        logsSnapshot.docs.forEach((doc) => logsBatch.delete(doc.ref));
        await logsBatch.commit();
      }

      return NextResponse.json({ success: true, deleted: snapshot.size });
    }

    if (!affiliateId) {
      return NextResponse.json({ error: 'affiliateId requis' }, { status: 400 });
    }

    // Delete single affiliate
    const docRef = db.collection('affiliates').doc(affiliateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Affilié non trouvé' }, { status: 404 });
    }

    const data = doc.data()!;
    if (data.stripeAccountId) {
      await stripe.accounts.del(data.stripeAccountId).catch((e) => {
        console.warn(`Failed to delete Stripe account ${data.stripeAccountId}:`, e.message);
      });
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[dev/affiliates] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
