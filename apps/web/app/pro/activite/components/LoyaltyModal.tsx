'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Switch, useToast } from '@/components/ui';
import { Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { providerService } from '@booking-app/firebase';
import type { LoyaltySettings, Service } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface LoyaltyModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Prestations du prestataire — pour le sélecteur d'éligibilité (opt-out). */
  services: WithId<Service>[];
}

/**
 * Éditeur de la carte de fidélité. Écrit `provider.settings.loyalty` via
 * providerService.updateSettings (merge côté service, comme la promotion
 * globale — les autres réglages sont préservés).
 *
 * Modèle opt-out pour l'éligibilité : toutes les prestations sont éligibles
 * par défaut, les ids décochés partent dans `excludedServiceIds` (même
 * logique que `ServiceDiscount.excludedIds` côté promos).
 */
export function LoyaltyModal({ isOpen, onClose, services }: LoyaltyModalProps) {
  const { provider, refreshProvider } = useAuth();
  const toast = useToast();
  const current = provider?.settings?.loyalty ?? null;

  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [rewardType, setRewardType] = useState<'percent' | 'amount'>('percent');
  const [rewardValue, setRewardValue] = useState(10); // % OU centimes selon rewardType
  const [excludedServiceIds, setExcludedServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (current) {
      setEnabled(current.enabled);
      setThreshold(current.threshold);
      setRewardType(current.rewardType);
      setRewardValue(current.rewardValue);
      setExcludedServiceIds(current.excludedServiceIds ?? []);
    } else {
      setEnabled(false);
      setThreshold(5);
      setRewardType('percent');
      setRewardValue(10);
      setExcludedServiceIds([]);
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleService = (id: string) => {
    setExcludedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const switchRewardType = (next: 'percent' | 'amount') => {
    if (next === rewardType) return;
    setRewardType(next);
    // Valeurs de départ raisonnables pour chaque unité (%, centimes).
    setRewardValue(next === 'percent' ? 10 : 500);
  };

  const handleSave = async () => {
    if (!provider) return;
    if (enabled) {
      if (!Number.isInteger(threshold) || threshold < 1) {
        setError('Le nombre de RDV doit être un entier supérieur ou égal à 1.');
        return;
      }
      if (rewardType === 'percent' && (rewardValue < 1 || rewardValue > 100)) {
        setError('La réduction doit être comprise entre 1 et 100 %.');
        return;
      }
      if (rewardType === 'amount' && rewardValue < 1) {
        setError('Le montant de la réduction doit être supérieur à 0 €.');
        return;
      }
      if (services.length > 0 && excludedServiceIds.length >= services.length) {
        setError('Au moins une prestation doit rester éligible à la récompense.');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const loyalty: LoyaltySettings | null = enabled
        ? {
            enabled: true,
            threshold,
            rewardType,
            rewardValue,
            excludedServiceIds,
          }
        : null;
      // updateSettings merge avec les réglages existants côté service —
      // les autres clés (notifications, promo globale…) sont préservées.
      await providerService.updateSettings(provider.id, { loyalty });
      await refreshProvider();
      toast.success(enabled ? 'Carte de fidélité enregistrée' : 'Carte de fidélité désactivée');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md w-full">
      <div className="p-5 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Carte de fidélité
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tous les X RDV honorés, la première prestation éligible de la réservation
            suivante est réduite. Tout est automatique : rien à tamponner.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Activer la carte de fidélité
          </span>
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label>

        {enabled && (
          <div className="space-y-4">
            <Input
              label="Nombre de RDV honorés requis"
              numericValue={threshold}
              onNumericChange={(n) => setThreshold(Math.round(n))}
              min={1}
              max={100}
              suffix="RDV"
            />

            {/* Type de récompense */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Type de réduction
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => switchRewardType('percent')}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    rewardType === 'percent'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Pourcentage
                </button>
                <button
                  type="button"
                  onClick={() => switchRewardType('amount')}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    rewardType === 'amount'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Montant fixe
                </button>
              </div>
            </div>

            {rewardType === 'percent' ? (
              <Input
                label="Réduction (%)"
                numericValue={rewardValue}
                onNumericChange={(p) => setRewardValue(Math.round(p))}
                min={1}
                max={100}
                suffix="%"
              />
            ) : (
              <Input
                label="Réduction (€)"
                numericValue={rewardValue / 100}
                onNumericChange={(n) => setRewardValue(Math.round(n * 100))}
                decimal
                min={0.01}
                suffix="€"
              />
            )}

            {/* Prestations éligibles — opt-out, cochées par défaut */}
            {services.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Prestations éligibles
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cliquez une prestation pour l&apos;inclure ou l&apos;exclure de la récompense.
                </p>
                <div className="space-y-0.5 max-h-52 overflow-y-auto">
                  {services.map((s) => {
                    const eligible = !excludedServiceIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        className="w-full text-left -mx-1 px-1 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0 text-sm">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              eligible
                                ? 'bg-primary-500 border-primary-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {eligible && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span
                            className={`truncate ${
                              eligible
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {s.name}
                          </span>
                          {!eligible && (
                            <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                              non incluse
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tous les {threshold} RDV honorés, la première prestation éligible de la
              réservation suivante est réduite. Si une promotion fait déjà mieux, le
              client garde la meilleure des deux réductions — jamais le cumul.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-error-600 dark:text-error-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
