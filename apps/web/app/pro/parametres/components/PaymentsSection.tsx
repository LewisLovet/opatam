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
  Percent,
  Clock,
  Save,
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
          'Désactiver votre abonnement Sérénité ?\n\n' +
          '• Plus de prélèvement de 5 €/mois\n' +
          '• Vous gardez l\'accès jusqu\'à la fin de votre période en cours\n' +
          '• Vous ne pourrez plus demander d\'acomptes après\n\n' +
          'Confirmer ?'
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
  // Hard gate: Connect must be fully active to subscribe to
  // Sérénité. A pending/restricted Connect account would cause
  // deposit charges to fail and block bookings client-side, so
  // refusing upfront is more user-friendly than letting them pay
  // 5€/mo for a feature that won't run. Matches the server-side
  // check in /api/pro/deposits-addon/activate.
  const canToggleAddon = hasPaidSubscription && connectActive;
  const addonActive = !!provider?.depositsAddonActive;

  // ── Default deposit (acomptes par défaut) — applied to every service ──
  // Local form state, init from the provider doc; saved via PUT.
  const existingDefault = provider?.settings?.depositDefault ?? null;
  const [defaultEnabled, setDefaultEnabled] = useState(false);
  const [defaultPercent, setDefaultPercent] = useState(30);
  const [defaultRefundHours, setDefaultRefundHours] = useState(24);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [defaultDirty, setDefaultDirty] = useState(false);

  // Hydrate the form whenever the provider doc changes (login, refresh)
  useEffect(() => {
    if (existingDefault) {
      setDefaultEnabled(true);
      setDefaultPercent(existingDefault.percent);
      setDefaultRefundHours(existingDefault.refundDeadlineHours);
    } else {
      setDefaultEnabled(false);
      setDefaultPercent(30);
      setDefaultRefundHours(24);
    }
    setDefaultDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id, existingDefault?.percent, existingDefault?.refundDeadlineHours]);

  const saveDefaultDeposit = async () => {
    setDefaultSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const body = defaultEnabled
        ? { percent: defaultPercent, refundDeadlineHours: defaultRefundHours }
        : { percent: null };
      const res = await fetch('/api/pro/deposits-default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(
        defaultEnabled ? 'Acompte par défaut enregistré' : 'Acompte par défaut désactivé'
      );
      setDefaultDirty(false);
      await refreshProvider();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
      toast.error(msg);
    } finally {
      setDefaultSaving(false);
    }
  };

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
                Activer les paiements prend ~5 minutes.
              </p>
              <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  À avoir sous la main
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                  <li>• Une pièce d&apos;identité</li>
                  <li>• Votre IBAN</li>
                  <li>• Un <strong>SIRET</strong> valide (votre numéro d&apos;entreprise)</li>
                </ul>
              </div>
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

      {/* ── Abonnement Sérénité (= add-on acomptes) ───────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        {!addonActive ? (
          // ─── État: pas souscrit ───────────────────────────────────────
          <>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Abonnement Sérénité
              </h4>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                5 €/mois
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Encaissez un acompte au moment de la réservation pour réduire les no-shows.
              Annulable à tout moment.
            </p>
            {!hasPaidSubscription && (
              <Link
                href="/pro/abonnement"
                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mb-3 hover:underline"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Souscrivez à un plan payant d'abord
              </Link>
            )}
            {hasPaidSubscription && !connectActive && (
              <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Activez d&apos;abord Stripe Connect ci-dessus. Sans compte
                  vérifié, les acomptes ne pourraient pas être encaissés et
                  bloqueraient les nouvelles réservations.
                </p>
              </div>
            )}
            <button
              type="button"
              disabled={addonWorking || !canToggleAddon}
              onClick={() => toggleAddon(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
            >
              {addonWorking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Souscrire à Sérénité — 5 €/mois</>
              )}
            </button>
          </>
        ) : (
          // ─── État: souscrit ───────────────────────────────────────────
          <>
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  Abonnement Sérénité actif
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  5 €/mois facturés sur votre prochaine échéance. Vous pouvez configurer
                  un acompte par défaut ci-dessous, ou un acompte spécifique pour chaque
                  prestation depuis{' '}
                  <Link
                    href="/pro/services"
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Prestations
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Subscribed but Connect not active yet — most likely
                because the pro just signed up and Stripe is still
                reviewing the KYC. Surface this clearly so they
                don't think they can charge deposits already. */}
            {!connectActive && (
              <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-semibold">Compte Stripe non vérifié</p>
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    Aucun acompte ne sera encaissé tant que Stripe n&apos;a pas
                    fini de vérifier votre compte. Terminez l&apos;onboarding
                    ci-dessus pour activer l&apos;encaissement.
                  </p>
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={addonWorking}
              onClick={() => toggleAddon(false)}
              className="text-sm text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {addonWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Désactiver l'abonnement
            </button>
          </>
        )}
      </div>

      {/* ── Default deposit configuration ───────────────────────────────── */}
      {addonActive && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                Acompte par défaut
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Appliqué automatiquement à toutes vos prestations qui n'ont pas de
                montant spécifique. Toujours en pourcentage du prix de la prestation.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={defaultEnabled}
              onClick={() => {
                setDefaultEnabled(!defaultEnabled);
                setDefaultDirty(true);
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                defaultEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  defaultEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {defaultEnabled && (
            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5" />
                    Pourcentage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={defaultPercent}
                      onChange={(e) => {
                        setDefaultPercent(
                          Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 0))
                        );
                        setDefaultDirty(true);
                      }}
                      className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Ex. 30 % d'un service à 40 € = acompte de 12 €
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Délai de remboursement
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      step={1}
                      value={defaultRefundHours}
                      onChange={(e) => {
                        setDefaultRefundHours(
                          Math.max(0, Math.min(720, parseInt(e.target.value, 10) || 0))
                        );
                        setDefaultDirty(true);
                      }}
                      className="w-full pl-3 pr-12 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      heures
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {defaultRefundHours === 0
                      ? "Aucun remboursement automatique"
                      : `Remboursé si annulation > ${defaultRefundHours}h avant le RDV`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {defaultDirty && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Modifications non enregistrées
              </p>
              <button
                type="button"
                onClick={saveDefaultDeposit}
                disabled={defaultSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {defaultSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Enregistrer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
