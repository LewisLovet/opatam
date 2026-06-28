'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Switch, useToast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { providerService } from '@booking-app/firebase';
import type { ServiceDiscount } from '@booking-app/shared';

interface GlobalPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Shop-wide promotion editor. Sets `provider.settings.globalDiscount`, applied
 * to every prestation that doesn't carry its own `discount`.
 */
export function GlobalPromoModal({ isOpen, onClose }: GlobalPromoModalProps) {
  const { provider, refreshProvider } = useAuth();
  const toast = useToast();
  const current = provider?.settings?.globalDiscount ?? null;

  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState(10);
  const [includeExtras, setIncludeExtras] = useState(true);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (current) {
      setEnabled(true);
      setPercent(current.percent);
      setIncludeExtras(current.includeExtras ?? true);
      setStartsAt(current.startsAt ?? null);
      setEndsAt(current.endsAt ?? null);
    } else {
      setEnabled(false);
      setPercent(10);
      setIncludeExtras(true);
      setStartsAt(null);
      setEndsAt(null);
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    if (!provider) return;
    if (enabled) {
      if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
        setError('La réduction doit être comprise entre 1 et 100 %.');
        return;
      }
      if (startsAt && endsAt && startsAt > endsAt) {
        setError('La date de fin doit être postérieure au début.');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const globalDiscount: ServiceDiscount | null = enabled
        ? { percent, includeExtras, startsAt, endsAt }
        : null;
      await providerService.updateProvider(provider.id, {
        settings: { ...(provider.settings ?? {}), globalDiscount },
      });
      await refreshProvider();
      toast.success(enabled ? 'Promotion globale enregistrée' : 'Promotion globale désactivée');
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
            Promotion globale
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Une réduction appliquée à toutes vos prestations, sauf celles qui ont déjà leur
            propre promotion.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Activer la promotion globale
          </span>
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label>

        {enabled && (
          <div className="space-y-4">
            <Input
              label="Réduction (%)"
              type="number"
              min={1}
              max={100}
              value={Number.isFinite(percent) ? percent : ''}
              onChange={(e) => setPercent(parseInt(e.target.value, 10) || 0)}
            />

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Appliquer aux variations et options
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Si désactivé, seul le prix de base de chaque prestation est réduit.
                </span>
              </span>
              <Switch
                checked={includeExtras}
                onChange={(e) => setIncludeExtras(e.target.checked)}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Début (optionnel)"
                type="date"
                value={startsAt ?? ''}
                onChange={(e) => setStartsAt(e.target.value || null)}
              />
              <Input
                label="Fin (optionnel)"
                type="date"
                value={endsAt ?? ''}
                onChange={(e) => setEndsAt(e.target.value || null)}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Laissez les dates vides pour une promotion permanente.
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
