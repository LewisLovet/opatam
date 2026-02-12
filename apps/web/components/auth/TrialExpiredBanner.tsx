'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export function TrialExpiredBanner() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl p-8 sm:p-10">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Votre accès a expiré
        </h2>

        {/* Subtitle */}
        <p className="mt-3 text-center text-gray-500">
          Choisissez un plan pour continuer à utiliser Opatam et garder votre
          profil visible.
        </p>

        {/* Feature reminders */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>Vos données sont conservées</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
            <span>Réactivation instantanée après souscription</span>
          </div>
        </div>

        {/* Primary CTA */}
        <Link
          href="/pro/parametres?tab=abonnement"
          className="mt-8 block w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-3.5 text-center font-semibold text-white shadow transition-opacity hover:opacity-90"
        >
          Choisir un plan
        </Link>

        {/* Secondary link */}
        <div className="mt-4 text-center">
          <a
            href="mailto:contact@opatam.com"
            className="text-sm text-gray-400 underline hover:text-gray-500"
          >
            Nous contacter
          </a>
        </div>
      </div>
    </div>
  );
}
