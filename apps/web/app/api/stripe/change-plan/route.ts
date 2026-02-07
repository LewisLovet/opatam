import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { PLAN_LIMITS, SUBSCRIPTION_PLANS } from '@booking-app/shared';

const getPlanDisplayName = (plan: string) =>
  SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]?.name ?? plan;

interface ChangePlanRequest {
  subscriptionId: string;
  newPriceId: string;
  newPlan: string;
  providerId: string;
}

export async function POST(request: NextRequest) {
  console.log('[STRIPE-CHANGE-PLAN] ========== START ==========');

  try {
    const body: ChangePlanRequest = await request.json();
    const { subscriptionId, newPriceId, newPlan, providerId } = body;

    console.log('[STRIPE-CHANGE-PLAN] Request:', {
      subscriptionId,
      newPriceId,
      newPlan,
      providerId,
    });

    // Validate required fields
    if (!subscriptionId || !newPriceId || !newPlan || !providerId) {
      return NextResponse.json(
        { message: 'subscriptionId, newPriceId, newPlan et providerId sont requis' },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();

    // Verify provider exists
    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json(
        { message: 'Provider introuvable' },
        { status: 404 },
      );
    }

    // Check plan limits before allowing the switch
    const limits = PLAN_LIMITS[newPlan as keyof typeof PLAN_LIMITS];
    if (limits) {
      const [membersSnap, locationsSnap] = await Promise.all([
        db.collection('providers').doc(providerId).collection('members')
          .where('isActive', '==', true).get(),
        db.collection('providers').doc(providerId).collection('locations')
          .where('isActive', '==', true).get(),
      ]);

      const activeMemberCount = membersSnap.size;
      const activeLocationCount = locationsSnap.size;

      if (activeMemberCount > limits.maxMembers) {
        return NextResponse.json(
          {
            message: `Vous avez ${activeMemberCount} membre(s) actif(s). Le plan ${getPlanDisplayName(newPlan)} est limite a ${limits.maxMembers}. Desactivez des membres avant de changer.`,
            code: 'MEMBER_LIMIT_EXCEEDED',
          },
          { status: 400 },
        );
      }

      if (activeLocationCount > limits.maxLocations) {
        return NextResponse.json(
          {
            message: `Vous avez ${activeLocationCount} lieu(x) actif(s). Le plan ${getPlanDisplayName(newPlan)} est limite a ${limits.maxLocations}. Desactivez des lieux avant de changer.`,
            code: 'LOCATION_LIMIT_EXCEEDED',
          },
          { status: 400 },
        );
      }
    }

    const stripe = getStripe();

    // Retrieve the current subscription to get the existing item ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (!subscription || subscription.status === 'canceled') {
      return NextResponse.json(
        { message: 'Abonnement introuvable ou annule' },
        { status: 400 },
      );
    }

    const existingItem = subscription.items.data[0];
    if (!existingItem) {
      return NextResponse.json(
        { message: "Aucun element d'abonnement trouve" },
        { status: 400 },
      );
    }

    console.log(`[STRIPE-CHANGE-PLAN] Switching item ${existingItem.id} from price ${existingItem.price.id} to ${newPriceId}`);

    // Update the subscription with the new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: existingItem.id, price: newPriceId }],
      metadata: { ...subscription.metadata, plan: newPlan },
      proration_behavior: 'create_prorations',
    });

    console.log(`[STRIPE-CHANGE-PLAN] SUCCESS - Subscription updated to plan: ${newPlan}, status: ${updatedSubscription.status}`);
    console.log('[STRIPE-CHANGE-PLAN] ========== END ==========');

    return NextResponse.json({
      success: true,
      plan: newPlan,
      status: updatedSubscription.status,
    });
  } catch (error: any) {
    console.error('[STRIPE-CHANGE-PLAN] EXCEPTION:', error);

    // Handle Stripe-specific errors with user-friendly messages
    if (error?.type === 'StripeInvalidRequestError') {
      if (error?.code === 'resource_missing') {
        return NextResponse.json(
          {
            message: 'Abonnement introuvable sur Stripe. Votre abonnement a peut-etre ete cree dans un autre environnement (test/production). Veuillez re-souscrire.',
            code: 'SUBSCRIPTION_NOT_FOUND',
          },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { message: error?.message || 'Erreur Stripe' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 },
    );
  }
}
