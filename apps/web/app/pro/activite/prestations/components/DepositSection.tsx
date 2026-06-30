'use client';

import { Input } from '@/components/ui';
import type { ServiceFormData } from './types';

// Per-service deposit configuration with 3 explicit radio choices:
//   1. "Acompte par défaut"     → null (inherit provider default)
//   2. "Acompte personnalisé"   → { type: 'fixed' | 'percent', ... }
//   3. "Pas d'acompte"          → { type: 'none' }
//
// When the add-on isn't active the whole card is locked. Extracted from
// the legacy ServiceModal so the page editor and (transitional) modal can
// share the exact same logic.

type DepositMode = 'inherit' | 'custom' | 'none';

function depositMode(d: ServiceFormData['deposit']): DepositMode {
  if (!d) return 'inherit';
  if (d.type === 'none') return 'none';
  return 'custom';
}

interface DepositSectionProps {
  depositsEnabled: boolean;
  defaultDeposit: { percent: number; refundDeadlineHours: number } | null;
  servicePrice: number; // cents
  deposit: ServiceFormData['deposit'];
  onChange: (next: ServiceFormData['deposit']) => void;
  error?: string;
}

export function DepositSection({
  depositsEnabled,
  defaultDeposit,
  servicePrice,
  deposit,
  onChange,
  error,
}: DepositSectionProps) {
  const mode = depositMode(deposit);

  // Add-on not active → locked card with link to /pro/parametres
  if (!depositsEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
        <div className="flex items-start gap-2">
          <span className="text-base">🔒</span>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white">Acompte</p>
            <p className="text-xs mt-1">
              Activez l&apos;abonnement Sérénité pour demander un acompte sur cette prestation.{' '}
              <a
                href="/pro/parametres?tab=paiements"
                className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Aller aux paramètres →
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fmt = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
  const defaultAmount = defaultDeposit
    ? Math.round((servicePrice * defaultDeposit.percent) / 100)
    : 0;
  const overrideAmount =
    deposit && deposit.type !== 'none'
      ? deposit.type === 'fixed'
        ? deposit.value ?? 0
        : Math.round((servicePrice * (deposit.value ?? 0)) / 100)
      : 0;

  const setMode = (next: DepositMode) => {
    if (next === 'inherit') return onChange(null);
    if (next === 'none') return onChange({ type: 'none' });
    // 'custom' — seed with sensible defaults if coming from another mode
    if (mode !== 'custom') {
      onChange({ type: 'percent', value: 30, refundDeadlineHours: 24 });
    }
  };

  return (
    <div className="space-y-3">
      {/* 3 radio choices */}
      <div className="space-y-2">
        <DepositRadio
          checked={mode === 'inherit'}
          onSelect={() => setMode('inherit')}
          label={defaultDeposit ? 'Acompte par défaut' : 'Aucun acompte (par défaut)'}
          hint={
            defaultDeposit
              ? `${defaultDeposit.percent} % du prix${
                  servicePrice > 0 ? ` = ${fmt(defaultAmount)}` : ''
                } · remboursable jusqu'à ${defaultDeposit.refundDeadlineHours}h avant le RDV`
              : 'Aucun acompte par défaut configuré → pas d\'acompte demandé sur cette prestation.'
          }
        />
        <DepositRadio
          checked={mode === 'custom'}
          onSelect={() => setMode('custom')}
          label="Acompte personnalisé"
          hint="Remplace l'acompte par défaut avec une valeur spécifique à cette prestation."
        />
        <DepositRadio
          checked={mode === 'none'}
          onSelect={() => setMode('none')}
          label="Pas d'acompte"
          hint={
            defaultDeposit
              ? "Désactive explicitement l'acompte sur cette prestation, même si vous avez un acompte par défaut."
              : 'Pas d\'acompte demandé sur cette prestation.'
          }
        />
      </div>

      {mode === 'custom' && deposit && deposit.type !== 'none' && (
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({
                  type: 'percent',
                  value: 30,
                  refundDeadlineHours: deposit.refundDeadlineHours ?? 24,
                })
              }
              className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                deposit.type === 'percent'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              Pourcentage
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  type: 'fixed',
                  value: Math.min(servicePrice, 1000),
                  refundDeadlineHours: deposit.refundDeadlineHours ?? 24,
                })
              }
              className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                deposit.type === 'fixed'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              Montant fixe
            </button>
          </div>

          {/* Value input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                {deposit.type === 'percent' ? 'Pourcentage' : 'Montant'}
              </label>
              <Input
                numericValue={
                  deposit.type === 'percent' ? deposit.value ?? 0 : (deposit.value ?? 0) / 100
                }
                onNumericChange={(n) =>
                  onChange({
                    ...deposit,
                    value: deposit.type === 'percent' ? Math.round(n) : Math.round(n * 100),
                  })
                }
                decimal={deposit.type === 'fixed'}
                min={1}
                max={deposit.type === 'percent' ? 100 : servicePrice / 100}
                suffix={deposit.type === 'percent' ? '%' : '€'}
                error={error}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Délai de remboursement
              </label>
              <Input
                numericValue={deposit.refundDeadlineHours ?? 24}
                onNumericChange={(h) =>
                  onChange({ ...deposit, refundDeadlineHours: Math.round(h) })
                }
                min={0}
                max={720}
                suffix="heures"
              />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-md bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">Acompte demandé :</strong>{' '}
            {servicePrice > 0 ? fmt(overrideAmount) : 'configurez d\'abord le prix'}
            {(deposit.refundDeadlineHours ?? 0) === 0
              ? ' · non remboursable'
              : ` · remboursé si annulation > ${deposit.refundDeadlineHours} h avant`}
          </div>
        </div>
      )}
    </div>
  );
}

function DepositRadio({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-md border p-3 transition-colors ${
        checked
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
            checked ? 'border-primary-600 bg-primary-600' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              checked ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-white'
            }`}
          >
            {label}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>
        </div>
      </div>
    </button>
  );
}
