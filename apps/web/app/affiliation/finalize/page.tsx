/**
 * /affiliation/finalize?token=…
 *
 * Magic-link landing for the email reminder we send to affiliates
 * with an incomplete Stripe Connect account. Looks up the affiliate
 * by `onboardingResumeToken`, validates it's not expired, and
 * generates a fresh Stripe AccountLink (5-min TTL is fine — we're
 * about to redirect immediately).
 *
 * Server component. No login required: the token IS the auth.
 *
 * Possible outcomes:
 *   - token valid + status not active   → 307 to Stripe AccountLink
 *   - status already active             → message "déjà actif" + CTA
 *   - token missing/expired/unknown     → message d'erreur générique
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

type Outcome =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'already_active'; affiliateName: string }
  | { kind: 'redirect'; url: string };

async function resolveToken(token: string | undefined): Promise<Outcome> {
  if (!token) return { kind: 'invalid' };

  const db = getAdminFirestore();
  const snap = await db
    .collection('affiliates')
    .where('onboardingResumeToken', '==', token)
    .limit(1)
    .get();

  if (snap.empty) return { kind: 'invalid' };
  const doc = snap.docs[0];
  const data = doc.data();

  const expiresAt = data.onboardingResumeTokenExpiresAt?.toDate?.() ?? null;
  if (!expiresAt || expiresAt < new Date()) return { kind: 'expired' };

  if (data.stripeAccountStatus === 'active') {
    return { kind: 'already_active', affiliateName: data.name || '' };
  }

  // Generate the AccountLink right now and redirect.
  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  const accountLink = await stripe.accountLinks.create({
    account: data.stripeAccountId,
    refresh_url: `${baseUrl}/affiliation/finalize?token=${token}`,
    return_url: `${baseUrl}/affiliation/dashboard?stripe=success`,
    type: 'account_onboarding',
  });

  return { kind: 'redirect', url: accountLink.url };
}

export default async function FinalizePage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const outcome = await resolveToken(token);

  if (outcome.kind === 'redirect') {
    redirect(outcome.url);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        {outcome.kind === 'invalid' && (
          <>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Lien invalide
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Ce lien est introuvable ou a déjà été remplacé. Connectez-vous à votre espace affilié pour finaliser votre compte.
            </p>
            <Link
              href="/affiliation/login"
              className="inline-flex items-center px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Se connecter
            </Link>
          </>
        )}

        {outcome.kind === 'expired' && (
          <>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Lien expiré
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Ce lien d'activation a expiré. Connectez-vous à votre espace affilié — un nouveau lien vous sera renvoyé automatiquement à la prochaine relance.
            </p>
            <Link
              href="/affiliation/login"
              className="inline-flex items-center px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Se connecter
            </Link>
          </>
        )}

        {outcome.kind === 'already_active' && (
          <>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Compte déjà actif
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Bonne nouvelle, {outcome.affiliateName}, votre compte affilié est déjà finalisé. Vous recevez vos commissions normalement.
            </p>
            <Link
              href="/affiliation/dashboard"
              className="inline-flex items-center px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Aller à mon dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
