'use client';

import Link from 'next/link';
import {
  Rocket,
  CalendarCheck,
  Globe,
  Bell,
  Clock,
  Shield,
  ArrowRight,
  Check,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Réservations illimitées',
    description: '0% de commission sur chaque réservation',
  },
  {
    icon: Globe,
    title: 'Votre vitrine en ligne',
    description: 'Page publique professionnelle personnalisée',
  },
  {
    icon: Bell,
    title: 'Rappels automatiques',
    description: 'Email et push pour réduire les absences',
  },
  {
    icon: Clock,
    title: 'Agenda 24h/24',
    description: 'Accessible partout, pour vous et vos clients',
  },
];

export function TrialExpiredBanner() {
  const soloPlan = SUBSCRIPTION_PLANS.solo;
  const monthlyPrice = (soloPlan.monthlyPrice / 100).toFixed(2).replace('.', ',');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-5 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 mb-4">
            <Rocket className="h-7 w-7 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Passez à la vitesse supérieure
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Votre période d&apos;essai est terminée. Activez votre plan pour continuer à développer votre activité.
          </p>
        </div>

        {/* Features grid */}
        <div className="px-8 pb-5">
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
              >
                <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400 mb-1.5" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                  {feature.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Reassurance */}
        <div className="mx-8 mb-5 flex items-center gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3">
          <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Vos données sont intactes
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Retrouvez tout votre contenu dès l&apos;activation
            </p>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="px-8 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                À partir de
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{monthlyPrice}€</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/mois</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Sans engagement
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Activation instantanée
              </span>
            </div>
          </div>

          <Link
            href="/pro/parametres?tab=abonnement"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 py-3.5 text-center font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200"
          >
            Voir les plans
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-3 text-center">
            <a
              href="mailto:contact@opatam.com"
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              Une question ? Contactez-nous
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
