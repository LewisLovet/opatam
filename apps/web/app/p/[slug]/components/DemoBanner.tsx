'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { APP_CONFIG } from '@booking-app/shared/constants';

/**
 * Welcome modal shown when visiting the demo provider page.
 * Marketing-focused: helps the visitor project themselves as a provider.
 */
export function DemoBanner() {
  const [showModal, setShowModal] = useState(false);

  // Show modal on mount with a slight delay for smoother UX
  useEffect(() => {
    const timer = setTimeout(() => setShowModal(true), 400);
    return () => clearTimeout(timer);
  }, []);

  if (!showModal) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-gray-950/40 backdrop-blur-sm animate-fade-in"
        onClick={() => setShowModal(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 pointer-events-auto animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setShowModal(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="text-center">
            {/* Icon */}
            <div className="mx-auto w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-5">
              <Sparkles className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Bienvenue sur la boutique démo
            </h2>

            {/* Description */}
            <p className="mt-3 text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
              Cette page est un <span className="font-semibold text-gray-900 dark:text-white">exemple concret</span> de
              ce que vos clients verront quand ils réserveront chez vous.
            </p>

            <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
              Parcourez les prestations, sélectionnez un professionnel et choisissez un créneau
              &mdash; exactement comme vos futurs clients le feront.
            </p>

            {/* Highlight box */}
            <div className="mt-5 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
              <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                Votre page de réservation peut être prête en 5 minutes, sans aucune compétence technique.
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 text-white hover:bg-primary-700 px-6 py-3 text-sm font-semibold rounded-lg transition-colors"
              >
                Explorer la démo
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                href="/register"
                className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                Créer ma page gratuitement ({APP_CONFIG.trialDays} jours d&apos;essai)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
