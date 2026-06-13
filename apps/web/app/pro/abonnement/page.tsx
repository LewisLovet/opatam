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
import { Percent, CalendarCheck, ShieldCheck } from 'lucide-react';
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
      {/* Premium animated hero header — sets the tone for a conversion page */}
      <header className="relative overflow-hidden rounded-2xl px-6 py-7 sm:px-9 sm:py-9 shadow-xl shadow-primary-600/20 bg-gradient-to-br from-primary-600 via-primary-600 to-primary-700 animate-gradient-pan animate-fade-in-up">
        {/* Floating light accents */}
        <div className="pointer-events-none absolute -top-16 -right-12 h-60 w-60 rounded-full bg-white/20 blur-3xl animate-soft-glow" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-primary-300/30 blur-3xl animate-float" />

        <div className="relative">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Abonnement
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
            Gérez votre formule et votre facturation, et débloquez tout le
            potentiel d&apos;Opatam pour développer votre activité.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: Percent, label: '0% de commission' },
              { icon: CalendarCheck, label: 'Sans engagement' },
              { icon: ShieldCheck, label: 'Paiement sécurisé' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <SubscriptionSection />

      <SubscriptionSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        planName={planConfig.name}
        planFeatures={[...planConfig.features]}
      />
    </div>
  );
}
