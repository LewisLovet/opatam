import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_DEV || process.env.STRIPE_SECRET_KEY!);

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/**
 * GET /api/admin/affiliates — List all affiliates
 */
export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const snapshot = await db.collection('affiliates').orderBy('createdAt', 'desc').get();
    const affiliates = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({ affiliates });
  } catch (err: any) {
    console.error('[admin/affiliates] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/affiliates — Create affiliate
 * Body: { name, email, code, commission, discount?, discountDuration? }
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, code, commission = 20, discount = null, discountDuration = null } = body;

    if (!name || !email || !code) {
      return NextResponse.json({ error: 'name, email et code sont requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const auth = getAdminAuth();
    const normalizedCode = code.toUpperCase().trim();

    // Check code uniqueness
    const existing = await db.collection('affiliates').where('code', '==', normalizedCode).get();
    if (!existing.empty) {
      return NextResponse.json({ error: `Le code "${normalizedCode}" existe déjà` }, { status: 409 });
    }

    // 1. Create Stripe Connect Custom account
    const accountToken = await stripe.tokens.create({
      account: {
        business_type: 'individual',
        individual: {
          first_name: name.split(' ')[0] || name,
          last_name: name.split(' ').slice(1).join(' ') || 'Affiliate',
          email,
        },
        tos_shown_and_accepted: true,
      },
    });

    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'FR',
      email,
      account_token: accountToken.id,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: {
        affiliateCode: normalizedCode,
        affiliateName: name,
      },
    });

    // 2. Create Stripe Coupon if discount
    let stripeCouponId: string | null = null;
    if (discount && discount > 0) {
      const couponParams: Stripe.CouponCreateParams = {
        percent_off: discount,
        currency: 'eur',
        name: `Code ${normalizedCode} — ${discount}% de réduction`,
      };

      if (discountDuration === 'once') {
        couponParams.duration = 'once';
      } else if (discountDuration === 'repeating_3') {
        couponParams.duration = 'repeating';
        couponParams.duration_in_months = 3;
      } else if (discountDuration === 'repeating_12') {
        couponParams.duration = 'repeating';
        couponParams.duration_in_months = 12;
      } else if (discountDuration === 'forever') {
        couponParams.duration = 'forever';
      } else {
        couponParams.duration = 'once';
      }

      const coupon = await stripe.coupons.create(couponParams);
      stripeCouponId = coupon.id;
    }

    // 3. Check if Firebase Auth user exists, or create one
    let userId: string | null = null;
    try {
      const existingUser = await auth.getUserByEmail(email);
      userId = existingUser.uid;
    } catch {
      // User doesn't exist — create one and send password reset
      const newUser = await auth.createUser({
        email,
        displayName: name,
      });
      userId = newUser.uid;

      // Create user doc in Firestore
      await db.collection('users').doc(userId).set({
        email,
        displayName: name,
        phone: null,
        photoURL: null,
        role: 'client',
        providerId: null,
        affiliateId: null, // Will be updated below
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
        pushTokens: [],
        isDisabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send password reset email
      const resetLink = await auth.generatePasswordResetLink(email);
      // TODO: Send branded email with resetLink via Resend
      console.log(`[admin/affiliates] Password reset link for ${email}: ${resetLink}`);
    }

    // 4. Generate onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/affiliation/dashboard`,
      return_url: `${baseUrl}/affiliation/dashboard`,
      type: 'account_onboarding',
    });

    // 5. Save affiliate to Firestore
    const affiliateData = {
      userId,
      name,
      email,
      code: normalizedCode,
      stripeAccountId: account.id,
      stripeAccountStatus: 'pending',
      commission: Number(commission),
      discount: discount ? Number(discount) : null,
      discountDuration: discount ? (discountDuration || 'once') : null,
      stripeCouponId,
      stats: {
        totalReferrals: 0,
        activeReferrals: 0,
        trialReferrals: 0,
        totalRevenue: 0,
        totalCommission: 0,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const docRef = await db.collection('affiliates').add(affiliateData);

    // 6. Link affiliateId on user doc
    if (userId) {
      await db.collection('users').doc(userId).update({
        affiliateId: docRef.id,
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      affiliate: {
        id: docRef.id,
        ...affiliateData,
        createdAt: affiliateData.createdAt.toISOString(),
        updatedAt: affiliateData.updatedAt.toISOString(),
      },
      onboardingUrl: accountLink.url,
    });
  } catch (err: any) {
    console.error('[admin/affiliates] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/affiliates — Delete affiliate
 * Body: { affiliateId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

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

    // Delete Stripe Connect account
    if (data.stripeAccountId) {
      await stripe.accounts.del(data.stripeAccountId).catch(() => {});
    }

    // Delete Stripe Coupon
    if (data.stripeCouponId) {
      await stripe.coupons.del(data.stripeCouponId).catch(() => {});
    }

    // Remove affiliateId from user doc + delete Auth account if it was created by us
    if (data.userId) {
      const auth = getAdminAuth();
      const userDoc = await db.collection('users').doc(data.userId).get();
      const userData = userDoc.data();

      // Only delete Auth + user doc if the user has no other role (pure affiliate account)
      const isPureAffiliate = userData && userData.role === 'client' && !userData.providerId;
      if (isPureAffiliate) {
        await auth.deleteUser(data.userId).catch(() => {});
        await db.collection('users').doc(data.userId).delete().catch(() => {});
      } else {
        // Just remove the affiliateId link
        await db.collection('users').doc(data.userId).update({
          affiliateId: null,
          updatedAt: new Date(),
        }).catch(() => {});
      }
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/affiliates] DELETE error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
