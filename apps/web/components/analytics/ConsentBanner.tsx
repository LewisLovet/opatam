'use client';

/**
 * RGPD cookie-consent banner — fixed at the bottom of the viewport
 * until the visitor makes a choice. Both buttons are visually
 * equivalent (no dark pattern): CNIL guidance is that refusing
 * must be as easy as accepting.
 *
 * Renders nothing once a decision has been made, on any subsequent
 * visit. Re-appears only if the consent storage key is bumped
 * (see useConsent).
 *
 * Only covers the Meta Pixel for now; if we add more third-party
 * trackers later they should all be gated on the same `granted`
 * state and the body copy below should be updated to list them.
 *
 * Privacy-friendly analytics already on the site (Vercel Analytics,
 * Speed Insights, Microsoft Clarity) don't gate on this banner —
 * they're cookieless / aggregate-only and Microsoft Clarity uses
 * IP anonymisation, so they're allowed without prior consent.
 */
import Link from 'next/link';
import { useConsent } from '@/hooks/useConsent';

export function ConsentBanner() {
  const { status, setConsent } = useConsent();

  // Hide once the user has made a decision OR while we're still
  // figuring it out on first render (the `'unknown'` server-render
  // state is rendered briefly before localStorage rehydrates).
  if (status !== 'unknown') return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-banner-title"
      className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <h2
              id="consent-banner-title"
              className="text-base font-semibold text-gray-900 dark:text-white mb-2"
            >
              Aidez-nous à faire grandir Opatam
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              En acceptant les cookies de mesure, vous nous aidez à
              savoir ce qui vous a amené ici et à mieux investir dans
              nos campagnes Instagram et Facebook. Refuser n&apos;a
              aucun impact sur votre expérience.{' '}
              <Link
                href="/legal/confidentialite"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                En savoir plus
              </Link>
            </p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:flex-shrink-0">
            <button
              type="button"
              onClick={() => setConsent('denied')}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => setConsent('granted')}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
