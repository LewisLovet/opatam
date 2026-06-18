'use client';

import { useEffect } from 'react';

/**
 * Reliable cross-origin redirect to Stripe.
 *
 * `redirect()` from next/navigation to an EXTERNAL URL doesn't issue a clean
 * HTTP 307 — it returns a 200 page with a client-side redirect that throws a
 * "client-side exception" on cross-origin navigation. We navigate the browser
 * directly instead, with a manual fallback link.
 */
export function StripeRedirect({ url }: { url: string }) {
  useEffect(() => {
    window.location.replace(url);
  }, [url]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
          Redirection vers Stripe…
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Vous allez être redirigé pour finaliser votre compte. Si rien ne se passe :
        </p>
        <a
          href={url}
          className="inline-flex items-center px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
        >
          Continuer vers Stripe
        </a>
      </div>
    </div>
  );
}
