'use client';

import { Input, Switch } from '@/components/ui';
import { Tag } from 'lucide-react';
import { EditorSection } from './EditorSection';
import type { ServiceFormData } from './types';

interface SectionPromotionProps {
  data: ServiceFormData;
  errors: Record<string, string>;
  update: (patch: Partial<ServiceFormData>) => void;
}

const DEFAULT_PROMO = {
  percent: 10,
  includeExtras: true,
  startsAt: null,
  endsAt: null,
} as const;

/**
 * Per-service promotion: a % off, optionally bounded by a date window, with a
 * toggle for whether variations/options are discounted too. Sits naturally in
 * the prestation editor next to the price.
 */
export function SectionPromotion({ data, errors, update }: SectionPromotionProps) {
  const promo = data.discount;
  const enabled = promo !== null;
  const hasVariations = data.variations.length > 0;

  const setPromo = (patch: Partial<NonNullable<ServiceFormData['discount']>>) =>
    update({ discount: { ...(promo ?? DEFAULT_PROMO), ...patch } });

  // Live preview of the discounted price on a flat-price prestation.
  const preview =
    enabled && !hasVariations && promo!.percent > 0
      ? Math.max(0, Math.round(data.price * (1 - promo!.percent / 100)))
      : null;

  return (
    <EditorSection
      title="Promotion"
      description="Une réduction en % sur cette prestation."
      icon={<Tag className="w-5 h-5" />}
      defaultOpen={enabled}
      forceOpen={!!errors.discountPercent || !!errors.discountEnd}
    >
      {/* Enable toggle */}
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Activer une promotion
        </span>
        <Switch
          checked={enabled}
          onChange={(e) =>
            update({ discount: e.target.checked ? { ...DEFAULT_PROMO } : null })
          }
        />
      </label>

      {enabled && promo && (
        <div className="space-y-4">
          {/* Percent */}
          <div>
            <Input
              label="Réduction (%)"
              type="number"
              min={1}
              max={100}
              value={Number.isFinite(promo.percent) ? promo.percent : ''}
              onChange={(e) => setPromo({ percent: parseInt(e.target.value, 10) || 0 })}
              error={errors.discountPercent}
            />
            {preview !== null && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Prix après réduction :{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {(preview / 100).toFixed(2).replace('.', ',')} €
                </span>{' '}
                <span className="line-through">
                  {(data.price / 100).toFixed(2).replace('.', ',')} €
                </span>
              </p>
            )}
          </div>

          {/* Include variations/options */}
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <span>
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Appliquer aux variations et options
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {promo.includeExtras
                  ? 'La réduction porte sur le total (variations et options incluses).'
                  : hasVariations
                    ? "Seule la base est réduite — peu utile ici, le prix vient des variations."
                    : 'Seul le prix de base est réduit ; les options gardent leur prix.'}
              </span>
            </span>
            <Switch
              checked={promo.includeExtras}
              onChange={(e) => setPromo({ includeExtras: e.target.checked })}
            />
          </label>

          {/* Date window */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Début (optionnel)"
              type="date"
              value={promo.startsAt ?? ''}
              onChange={(e) => setPromo({ startsAt: e.target.value || null })}
            />
            <Input
              label="Fin (optionnel)"
              type="date"
              value={promo.endsAt ?? ''}
              onChange={(e) => setPromo({ endsAt: e.target.value || null })}
              error={errors.discountEnd}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Laissez les dates vides pour une promotion permanente. La fin est incluse.
          </p>
        </div>
      )}
    </EditorSection>
  );
}
