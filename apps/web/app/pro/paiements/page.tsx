'use client';

/**
 * /pro/paiements — extracted from /pro/parametres tab "Paiements".
 *
 * Hosts Stripe Connect onboarding + Sérénité add-on subscription +
 * default deposit configuration. Splitting it out from the settings
 * tabs has two benefits:
 *   - the page can host the Stripe-redirect return URLs (?connect=
 *     return / refresh) without the Settings header noise around it
 *   - the sidebar gets a direct entry so the pro doesn't have to
 *     dig through Paramètres to find their payments setup
 *
 * The deposits-launch feature flag is still respected — the
 * canUseDepositsClient gate hides the page for non-admin users
 * during the soft launch, with a clean fallback message.
 */

import { Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canUseDepositsClient } from '@/lib/feature-flags';
import { PaymentsSection } from '../parametres/components';

export default function PaiementsPage() {
  const { user } = useAuth();

  if (!canUseDepositsClient(user)) {
    return (
      <div className="space-y-6">
        <header>
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Paiements
            </h1>
          </div>
        </header>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Cette fonctionnalité n&apos;est pas encore disponible publiquement.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Paiements & acomptes
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-9">
          Activez Stripe et configurez les acomptes pour réduire les no-shows.
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6 lg:p-8">
        <PaymentsSection />
      </div>
    </div>
  );
}
