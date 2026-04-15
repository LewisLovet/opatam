import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { getStripeDev } from '@/lib/stripe';

const stripe = getStripeDev();

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
    let isNewUser = false;
    try {
      const existingUser = await auth.getUserByEmail(email);
      userId = existingUser.uid;
    } catch {
      isNewUser = true;
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

      // Send welcome email with password reset link
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetLink = await auth.generatePasswordResetLink(email, {
        url: `${baseUrl}/affiliation/login`,
      });
      try {
        const { Resend } = await import('resend');
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: 'Opatam <noreply@kamerleontech.com>',
            to: email,
            subject: `Bienvenue dans le programme d'affiliation Opatam`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: #4F46E5; color: white; font-weight: bold; font-size: 18px; padding: 12px 20px; border-radius: 12px;">Opatam</div>
                </div>
                <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px;">Bienvenue ${name} !</h1>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
                  Vous avez été invité(e) à rejoindre le programme d'affiliation Opatam. Votre code parrain est <strong style="color: #4F46E5;">${normalizedCode}</strong>.
                </p>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
                  Pour accéder à votre espace affilié, commencez par créer votre mot de passe :
                </p>
                <div style="text-align: center; margin-bottom: 32px;">
                  <a href="${resetLink}" style="display: inline-block; background: #4F46E5; color: white; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                    Créer mon mot de passe
                  </a>
                </div>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 8px;">
                  Ensuite, connectez-vous sur votre dashboard :
                </p>
                <p style="margin-bottom: 24px;">
                  <a href="https://opatam.com/affiliation/login" style="font-size: 14px; color: #4F46E5; font-weight: 600;">opatam.com/affiliation/login</a>
                </p>
                <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                  <p style="font-size: 13px; color: #92400E; margin: 0;">
                    <strong>Important :</strong> Pour recevoir vos commissions, connectez-vous à votre dashboard et cliquez sur "Configurer mon compte Stripe" pour finaliser votre inscription.
                  </p>
                </div>
                <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 20px;">
                  <p style="font-size: 12px; color: #9CA3AF;">
                    Votre commission : ${commission}%${discount ? ` · Réduction filleuls : -${discount}%` : ''}
                  </p>
                  <p style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">
                    Lien de partage : opatam.com/register?ref=${normalizedCode}
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`[admin/affiliates] Welcome email sent to ${email}`);
        } else {
          console.warn(`[admin/affiliates] RESEND_API_KEY not set, password reset link: ${resetLink}`);
        }
      } catch (emailErr) {
        console.error('[admin/affiliates] Email send error (non-blocking):', emailErr);
      }
    }

    // Send welcome email to existing users (no password reset needed)
    if (!isNewUser && userId) {
      try {
        const { Resend } = await import('resend');
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          const result = await resend.emails.send({
            from: 'Opatam <noreply@kamerleontech.com>',
            to: email,
            subject: `Vous êtes maintenant affilié Opatam !`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: #4F46E5; color: white; font-weight: bold; font-size: 18px; padding: 12px 20px; border-radius: 12px;">Opatam</div>
                </div>
                <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px;">Bienvenue ${name} !</h1>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
                  Vous faites maintenant partie du programme d'affiliation Opatam. Votre code parrain est <strong style="color: #4F46E5;">${normalizedCode}</strong>.
                </p>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 24px;">
                  Connectez-vous avec vos identifiants habituels pour accéder à votre dashboard affilié. Pensez à configurer votre compte Stripe depuis le dashboard pour activer la réception de vos commissions.
                </p>
                <div style="text-align: center; margin-bottom: 32px;">
                  <a href="https://opatam.com/affiliation/login" style="display: inline-block; background: #4F46E5; color: white; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                    Accéder à mon dashboard
                  </a>
                </div>
                <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                  <p style="font-size: 13px; color: #92400E; margin: 0;">
                    <strong>Important :</strong> Pour recevoir vos commissions, connectez-vous à votre dashboard et cliquez sur "Configurer mon compte Stripe" pour finaliser votre inscription.
                  </p>
                </div>
                <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 20px;">
                  <p style="font-size: 12px; color: #9CA3AF;">
                    Votre commission : ${commission}%${discount ? ` · Réduction filleuls : -${discount}%` : ''}
                  </p>
                  <p style="font-size: 12px; color: #9CA3AF; margin-top: 4px;">
                    Lien de partage : opatam.com/register?ref=${normalizedCode}
                  </p>
                </div>
              </div>
            `,
          });
          console.log(`[admin/affiliates] Welcome email sent to existing user ${email}`, JSON.stringify(result));
        }
      } catch (emailErr) {
        console.error('[admin/affiliates] Email send error (non-blocking):', emailErr);
      }
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
 * PATCH /api/admin/affiliates — Update affiliate (commission, discount, isActive)
 * Body: { affiliateId, commission?, discount?, discountDuration?, isActive? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid || !(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { affiliateId, commission, discount, discountDuration, isActive } = body;

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
    const updateData: Record<string, any> = { updatedAt: new Date() };
    const changes: string[] = [];

    if (commission !== undefined && commission !== data.commission) {
      updateData.commission = Number(commission);
      changes.push(`Commission : ${data.commission}% → ${commission}%`);
    }

    // Handle discount change — update or create Stripe coupon
    const newDiscount = discount !== undefined ? (discount ? Number(discount) : null) : undefined;
    const newDuration = discountDuration || data.discountDuration || 'once';

    if (newDiscount !== undefined && (newDiscount !== data.discount || newDuration !== data.discountDuration)) {
      // Delete old coupon if exists
      if (data.stripeCouponId) {
        await stripe.coupons.del(data.stripeCouponId).catch(() => {});
      }

      if (newDiscount && newDiscount > 0) {
        // Create new coupon
        const couponParams: any = {
          percent_off: newDiscount,
          currency: 'eur',
          name: `Code ${data.code} — ${newDiscount}% de réduction`,
        };
        if (newDuration === 'once') couponParams.duration = 'once';
        else if (newDuration === 'repeating_3') { couponParams.duration = 'repeating'; couponParams.duration_in_months = 3; }
        else if (newDuration === 'repeating_12') { couponParams.duration = 'repeating'; couponParams.duration_in_months = 12; }
        else if (newDuration === 'forever') couponParams.duration = 'forever';
        else couponParams.duration = 'once';

        const coupon = await stripe.coupons.create(couponParams);
        updateData.stripeCouponId = coupon.id;
        updateData.discount = newDiscount;
        updateData.discountDuration = newDuration;
        changes.push(`Réduction : ${data.discount || 0}% → ${newDiscount}%`);
      } else {
        updateData.stripeCouponId = null;
        updateData.discount = null;
        updateData.discountDuration = null;
        if (data.discount) changes.push(`Réduction supprimée (était ${data.discount}%)`);
      }
    }

    if (isActive !== undefined && isActive !== data.isActive) {
      updateData.isActive = isActive;
      changes.push(isActive ? 'Compte activé' : 'Compte désactivé');
    }

    await docRef.update(updateData);

    // Send email notification if commission changed
    if (changes.length > 0) {
      try {
        const { Resend } = await import('resend');
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          await resend.emails.send({
            from: 'Opatam <noreply@kamerleontech.com>',
            to: data.email,
            subject: 'Mise à jour de votre compte affilié Opatam',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: #4F46E5; color: white; font-weight: bold; font-size: 18px; padding: 12px 20px; border-radius: 12px;">Opatam</div>
                </div>
                <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 8px;">Bonjour ${data.name},</h1>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin-bottom: 16px;">
                  Votre compte affilié a été mis à jour :
                </p>
                <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                  ${changes.map((c) => `<p style="font-size: 14px; color: #374151; margin: 4px 0;">• ${c}</p>`).join('')}
                </div>
                <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
                  Ces modifications prennent effet immédiatement.
                </p>
                <div style="text-align: center; margin-top: 24px;">
                  <a href="https://opatam.com/affiliation/dashboard" style="display: inline-block; background: #4F46E5; color: white; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                    Voir mon dashboard
                  </a>
                </div>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        console.error('[admin/affiliates] PATCH email error:', emailErr);
      }
    }

    return NextResponse.json({ success: true, changes });
  } catch (err: any) {
    console.error('[admin/affiliates] PATCH error:', err);
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
