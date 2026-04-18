'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Mail,
  User as UserIcon,
  Zap,
  ShieldCheck,
} from 'lucide-react';

import { useAffiliate } from '../_shared/useAffiliate';

const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'pending' | 'bad' }> = {
  active: { label: 'Actif', tone: 'ok' },
  pending: { label: 'En attente', tone: 'pending' },
  restricted: { label: 'Restreint', tone: 'bad' },
};

export default function ComptePage() {
  // Compte page only needs the affiliate doc — no logs, no aggregates.
  const { affiliate, loading } = useAffiliate({ logsLimit: 0 });
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleOpenOnboarding = async () => {
    if (!affiliate) return;
    setOnboardingLoading(true);
    try {
      const res = await fetch('/api/affiliates/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: affiliate.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setOnboardingLoading(false);
      }
    } catch {
      setOnboardingLoading(false);
    }
  };

  const handleSync = async () => {
    if (!affiliate) return;
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/affiliates/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: affiliate.id, force: true }),
      });
      const data = await res.json();
      if (data.changed) {
        setSyncResult(`Statut mis à jour : ${data.status}`);
      } else {
        setSyncResult(`Aucun changement — statut toujours : ${data.status ?? 'inconnu'}`);
      }
    } catch {
      setSyncResult('Erreur lors de la synchronisation');
    } finally {
      setSyncLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!affiliate) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400">Compte affilié non trouvé</p>
      </div>
    );
  }

  const status = STATUS_LABEL[affiliate.stripeAccountStatus] ?? {
    label: affiliate.stripeAccountStatus || 'inconnu',
    tone: 'pending' as const,
  };
  const isActive = status.tone === 'ok';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mon compte</h1>
        <p className="text-sm text-gray-500 mt-1">
          Informations personnelles et configuration Stripe
        </p>
      </div>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Profil</h2>
        </div>
        <dl className="divide-y divide-gray-100">
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-500">Nom</dt>
            <dd className="text-sm text-gray-900 font-medium">{affiliate.name}</dd>
          </div>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-500 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Email
            </dt>
            <dd className="text-sm text-gray-900 font-medium truncate">{affiliate.email}</dd>
          </div>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-500">Code affilié</dt>
            <dd className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-0.5 rounded">
              {affiliate.code}
            </dd>
          </div>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-500">Commission</dt>
            <dd className="text-sm text-gray-900 font-medium">{affiliate.commission}%</dd>
          </div>
          {affiliate.discount && affiliate.discount > 0 && (
            <div className="px-5 py-3 flex items-center justify-between gap-4">
              <dt className="text-sm text-gray-500">Réduction filleuls</dt>
              <dd className="text-sm text-gray-900 font-medium">{affiliate.discount}%</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Stripe status */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Compte Stripe Connect</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              status.tone === 'ok'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : status.tone === 'pending'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {status.tone === 'ok' ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
            {status.label}
          </span>
        </div>
        <div className="p-5">
          {isActive ? (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Vous êtes prêt à recevoir vos commissions
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Chaque commission sera automatiquement virée sur votre compte Stripe. Les
                  virements sont ensuite transférés vers votre compte bancaire selon les délais
                  Stripe habituels.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-4">
                Complétez la configuration de votre compte Stripe pour activer la réception de vos
                commissions. Vous serez redirigé vers Stripe pour saisir vos informations.
              </p>
              <button
                onClick={handleOpenOnboarding}
                disabled={onboardingLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {onboardingLoading ? 'Redirection...' : 'Configurer mon compte Stripe'}
              </button>
            </>
          )}

          {/* Force re-sync (useful if the user just finished onboarding but status is stuck) */}
          <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">
                Vous venez de finaliser l&apos;onboarding mais le statut n&apos;a pas été mis à
                jour ?
              </p>
              {syncResult && <p className="text-xs text-gray-700 mt-1">{syncResult}</p>}
            </div>
            <button
              onClick={handleSync}
              disabled={syncLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
              Vérifier le statut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
