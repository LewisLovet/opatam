'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Loader2,
  X,
  AlertCircle,
  Check,
  Calendar,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

interface PriceInfo {
  id: string;
  plan: string | null;
  unitAmount: number;
  interval: string | null;
}

interface PreviewData {
  currentPrice: PriceInfo;
  newPrice: PriceInfo;
  creditCents: number;
  chargeCents: number;
  netCents: number;
  currency: string;
  nextInvoiceDate: string | null;
  isUpgrade: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  newPriceId: string;
  newPlan: string;
  providerId: string;
  /** Friendly plan names — fallback to plan key */
  currentPlanLabel: string;
  newPlanLabel: string;
  /** Called on successful confirmation, with the preview so the parent can show
   *  a persistent success state. */
  onConfirmed: (summary: PreviewData) => void;
}

function formatEuro(cents: number): string {
  const amount = cents / 100;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '−' : ''}${formatted} €`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function intervalLabel(interval: string | null): string {
  return interval === 'year' ? '/an' : '/mois';
}

export function ChangePlanModal({
  open,
  onClose,
  subscriptionId,
  newPriceId,
  newPlan,
  providerId,
  currentPlanLabel,
  newPlanLabel,
  onConfirmed,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Fetch preview when the modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);

    (async () => {
      try {
        const res = await fetch('/api/stripe/change-plan/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId, newPriceId }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message ?? 'Impossible de calculer le changement.');
        } else {
          setPreview(data as PreviewData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur réseau');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, subscriptionId, newPriceId]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          newPriceId,
          newPlan,
          providerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Erreur lors du changement de plan.');
        setConfirming(false);
        return;
      }
      onConfirmed(preview);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
      setConfirming(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Changement de plan
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Calcul du changement...
              </p>
            </div>
          )}

          {/* Error state */}
          {!loading && error && !preview && (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{error}</p>
            </div>
          )}

          {/* Preview content */}
          {!loading && preview && (
            <>
              {/* Transition summary */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-400 mb-1">Actuel</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {currentPlanLabel}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatEuro(preview.currentPrice.unitAmount)}
                    {intervalLabel(preview.currentPrice.interval)}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-primary-500 mb-1">Nouveau</p>
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                    {newPlanLabel}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatEuro(preview.newPrice.unitAmount)}
                    {intervalLabel(preview.newPrice.interval)}
                  </p>
                </div>
              </div>

              {/* Prorata breakdown */}
              <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Ajusté au prorata
                </p>
                <dl className="space-y-2">
                  {preview.creditCents < 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-600 dark:text-gray-400">
                        Crédit {currentPlanLabel} non utilisé
                      </dt>
                      <dd className="font-medium text-emerald-600">
                        {formatEuro(preview.creditCents)}
                      </dd>
                    </div>
                  )}
                  {preview.chargeCents > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-gray-600 dark:text-gray-400">
                        Charge {newPlanLabel} au prorata
                      </dt>
                      <dd className="font-medium text-gray-900 dark:text-white">
                        +{formatEuro(preview.chargeCents)}
                      </dd>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 flex items-center justify-between">
                    <dt className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      {preview.isUpgrade ? (
                        <TrendingUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                      )}
                      {preview.isUpgrade
                        ? 'À payer sur la prochaine facture'
                        : 'Crédit sur la prochaine facture'}
                    </dt>
                    <dd
                      className={`text-lg font-bold ${
                        preview.isUpgrade
                          ? 'text-gray-900 dark:text-white'
                          : 'text-emerald-600'
                      }`}
                    >
                      {preview.isUpgrade
                        ? `+${formatEuro(preview.netCents)}`
                        : formatEuro(preview.netCents)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Info block */}
              <div className="flex items-start gap-2.5 mb-1">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Prochaine facture :{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDate(preview.nextInvoiceDate) || 'à la prochaine échéance'}
                  </span>
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Wallet className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Aucun paiement ni remboursement immédiat — tout passe sur votre prochaine facture.
                </p>
              </div>

              {/* Inline error on confirm */}
              {error && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || loading || !preview}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Confirmation...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirmer le changement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { PreviewData as ChangePlanPreview };
