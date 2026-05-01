'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui';
import { canUseDepositsClient } from '@/lib/feature-flags';
import { auth as firebaseAuth } from '@booking-app/firebase';

interface ConnectStatus {
  accountId: string | null;
  status: 'pending' | 'active' | 'restricted' | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    disabledReason: string | null;
  };
}

/**
 * Stripe Connect onboarding for the deposits add-on.
 *
 * State machine:
 *   - no account                → "Activer les paiements" CTA (calls create-account)
 *   - account pending/restricted → "Reprendre" CTA (calls refresh-link) +
 *                                  list of remaining KYC requirements
 *   - account active             → green confirmation + dashboard link
 *
 * After Stripe redirects back via ?connect=return, we hit /status to
 * sync immediately rather than waiting for the webhook.
 */
export function PaymentsSection() {
  const { user, provider, refreshProvider } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [addonWorking, setAddonWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getIdToken = useCallback(async () => {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Non authentifié');
    return user.getIdToken();
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/pro/stripe-connect/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  // Initial load + re-sync when Stripe redirects back
  useEffect(() => {
    if (!provider) return;
    fetchStatus();
  }, [provider, fetchStatus]);

  useEffect(() => {
    if (searchParams.get('connect') === 'return') {
      // Fresh sync right after the pro returns from onboarding
      fetchStatus();
    }
  }, [searchParams, fetchStatus]);

  const startOnboarding = async () => {
    setWorking(true);
    setError(null);
    try {
      const token = await getIdToken();
      const endpoint = status?.accountId
        ? '/api/pro/stripe-connect/refresh-link'
        : '/api/pro/stripe-connect/create-account';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Redirect the browser to Stripe's hosted onboarding
      window.location.href = data.onboardingUrl as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
      setWorking(false);
    }
  };

  // ── Add-on Acomptes (+5€/mois) toggle ─────────────────────────────────
  const toggleAddon = async (enable: boolean) => {
    setAddonWorking(true);
    setError(null);
    try {
      if (!enable) {
        const ok = window.confirm(
          'Désactiver l’add-on Acomptes ? Vous garderez la fonctionnalité jusqu’à la fin du mois en cours.'
        );
        if (!ok) {
          setAddonWorking(false);
          return;
        }
      }
      const token = await getIdToken();
      const path = enable
        ? '/api/pro/deposits-addon/activate'
        : '/api/pro/deposits-addon/deactivate';
      const res = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(enable ? 'Add-on Acomptes activé' : 'Add-on Acomptes désactivé');
      // Refresh provider doc so the toggle reflects the new state
      await refreshProvider();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
      toast.error(msg);
    } finally {
      setAddonWorking(false);
    }
  };

  // Pre-flight conditions for activating the add-on
  const hasPaidSubscription = !!provider?.subscription?.stripeSubscriptionId;
  const connectActive = status?.status === 'active';
  const canToggleAddon = hasPaidSubscription && connectActive;
  const addonActive = !!provider?.depositsAddonActive;

  // ── Render ─────────────────────────────────────────────────────────────

  // FIXME(deposits-launch): defense-in-depth — the parent page already
  // hides the tab, but if someone hot-reloads the component directly we
  // surface a clean "not available" state instead of leaking the form.
  // Remove this branch when FEATURE_FLAGS.depositsPublic flips to true.
  if (!canUseDepositsClient(user)) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Cette fonctionnalité n&apos;est pas encore disponible publiquement.
      </div>
    );
  }

  if (!provider || loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          Paiements & acomptes
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Activez Stripe pour accepter des acomptes lors des réservations. Vos clients paient
          un acompte à la prise de RDV ; les fonds arrivent sur votre IBAN.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* State: no account yet */}
      {!status?.accountId && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Pas encore configuré
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Activer les paiements prend ~5 minutes. Vous aurez besoin d&apos;une
                pièce d&apos;identité et de votre IBAN.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  Process Stripe — sécurisé et conforme RGPD
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  Acomptes versés directement sur votre IBAN
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  Aucune commission Opatam sur les acomptes
                </li>
              </ul>
              <button
                type="button"
                onClick={startOnboarding}
                disabled={working}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {working ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirection vers Stripe…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Activer les paiements
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State: pending / restricted */}
      {status?.accountId && status.status !== 'active' && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                {status.status === 'pending'
                  ? 'Onboarding en cours'
                  : 'Informations supplémentaires requises'}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {status.status === 'pending'
                  ? "Stripe vérifie vos informations. Cela peut prendre quelques minutes à 24h selon les pièces fournies."
                  : "Stripe a besoin d'informations supplémentaires pour activer votre compte."}
              </p>
              {status.requirements && status.requirements.currentlyDue.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                    Détails ({status.requirements.currentlyDue.length})
                  </summary>
                  <ul className="mt-1 ml-4 text-xs text-amber-700 dark:text-amber-400 list-disc">
                    {status.requirements.currentlyDue.map((req) => (
                      <li key={req}>{req}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button
                type="button"
                onClick={startOnboarding}
                disabled={working}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {working ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Reprendre l&apos;onboarding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State: active */}
      {status?.accountId && status.status === 'active' && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-green-800 dark:text-green-300">
                Paiements activés
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Vous pouvez maintenant configurer un acompte sur chaque prestation depuis
                la section Prestations.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Cartes : {status.chargesEnabled ? 'OK' : 'KO'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Virements : {status.payoutsEnabled ? 'OK' : 'KO'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-on Acomptes toggle ────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Add-on Acomptes
              </h4>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                +5 €/mois TTC
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Activez la possibilité de demander un acompte sur chaque prestation à la
              réservation. Réduit drastiquement les no-shows.
            </p>

            {/* Pre-flight hints */}
            {!hasPaidSubscription && (
              <Link
                href="/pro/parametres?tab=abonnement"
                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-2 hover:underline"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Souscrivez à un plan payant pour activer l’add-on
              </Link>
            )}
            {hasPaidSubscription && !connectActive && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Activez d’abord les paiements (Stripe Connect ci-dessus)
              </p>
            )}
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={addonActive}
            disabled={addonWorking || (!canToggleAddon && !addonActive)}
            onClick={() => toggleAddon(!addonActive)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              addonActive ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            {addonWorking ? (
              <Loader2 className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  addonActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            )}
          </button>
        </div>

        {addonActive && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Add-on actif. Configurez le montant de l’acompte sur chaque prestation
              dans la section{' '}
              <Link
                href="/pro/services"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Prestations
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
