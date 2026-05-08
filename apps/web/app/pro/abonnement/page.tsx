'use client';

/**
 * /pro/abonnement — extracted from /pro/parametres tab "Abonnement".
 *
 * Hosts the same SubscriptionSection used previously inside the
 * settings tabs. Splitting it out gives the section room to breathe
 * (it's a busy panel: plan switch, billing portal, success modal,
 * etc.) and shortens the settings page to actually-settings concerns.
 *
 * Legacy URL `/pro/parametres?tab=abonnement` redirects here via
 * the parametres page's effect — old emails / Stripe webhook
 * templates keep working.
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';
import {
  SubscriptionSection,
  SubscriptionSuccessModal,
} from '../parametres/components';

export default function AbonnementPage() {
  const searchParams = useSearchParams();
  const { provider } = useAuth();

  // Same Stripe-checkout-success detection as the previous tab —
  // ?success=true is appended by Stripe after a successful purchase
  // so we open the post-purchase modal once.
  const isCheckoutSuccess = searchParams.get('success') === 'true';
  const [showSuccessModal, setShowSuccessModal] = useState(isCheckoutSuccess);

  useEffect(() => {
    // Sync local state if the user navigates between abonnement
    // pages with different ?success values during the session.
    setShowSuccessModal(searchParams.get('success') === 'true');
  }, [searchParams]);

  const providerPlan = provider?.plan as keyof typeof SUBSCRIPTION_PLANS | undefined;
  const planConfig =
    providerPlan && providerPlan in SUBSCRIPTION_PLANS
      ? SUBSCRIPTION_PLANS[providerPlan as 'solo' | 'team' | 'test']
      : SUBSCRIPTION_PLANS.solo;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Abonnement
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-9">
          Plan, facturation, portail Stripe.
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6 lg:p-8">
        <SubscriptionSection />
      </div>

      <SubscriptionSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        planName={planConfig.name}
        planFeatures={[...planConfig.features]}
      />
    </div>
  );
}
