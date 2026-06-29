'use client';

import { Input, Switch } from '@/components/ui';
import { Tag } from 'lucide-react';
import { buildServiceDiscountPreview, type DiscountPreviewRow } from '@booking-app/shared';
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

function euro(cents: number): string {
  if (cents === 0) return 'Gratuit';
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** A "12 € → 9,60 €" line. When the discount doesn't apply, the price is shown
 *  once, greyed, with a hint — so the pro sees what is NOT discounted too. */
function PriceLine({ row }: { row: DiscountPreviewRow }) {
  const reduced = row.applies && row.discounted < row.original;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-gray-600 dark:text-gray-300 truncate">{row.name}</span>
      {reduced ? (
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-gray-400 line-through">{euro(row.original)}</span>
          <span className="font-semibold text-rose-600 dark:text-rose-400">{euro(row.discounted)}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-gray-500 dark:text-gray-400">{euro(row.original)}</span>
          {!row.applies && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">non incluse</span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * Per-service promotion: a % off, optionally bounded by a date window. The promo
 * always reduces the prestation core (base price or variations); a toggle adds
 * the add-on options. A live before/after preview shows the pro EXACTLY what
 * changes — base, each variation, each option.
 */
export function SectionPromotion({ data, errors, update }: SectionPromotionProps) {
  const promo = data.discount;
  const enabled = promo !== null;
  const hasOptions = data.options.length > 0;

  const setPromo = (patch: Partial<NonNullable<ServiceFormData['discount']>>) =>
    update({ discount: { ...(promo ?? DEFAULT_PROMO), ...patch } });

  const preview =
    enabled && promo
      ? buildServiceDiscountPreview(
          { price: data.price, variations: data.variations, options: data.options },
          promo,
        )
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
          <Input
            label="Réduction (%)"
            type="number"
            min={1}
            max={100}
            value={Number.isFinite(promo.percent) ? promo.percent : ''}
            onChange={(e) => setPromo({ percent: parseInt(e.target.value, 10) || 0 })}
            error={errors.discountPercent}
          />

          {/* Include add-on options — only relevant when the service has any.
              The prestation core (base or variations) is always discounted. */}
          {hasOptions && (
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Inclure les options et suppléments
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  La prestation (et ses variations) est toujours réduite.{' '}
                  {promo.includeExtras
                    ? 'Les options cochées sont réduites aussi.'
                    : 'Les options cochées gardent leur prix plein.'}
                </span>
              </span>
              <Switch
                checked={promo.includeExtras}
                onChange={(e) => setPromo({ includeExtras: e.target.checked })}
              />
            </label>
          )}

          {/* Live before/after preview */}
          {preview && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Aperçu des prix
                </span>
                <span className="text-[11px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded">
                  −{preview.percent}%
                </span>
              </div>

              {/* Base (variation-less services) */}
              {preview.base && (
                <PriceLine
                  row={{
                    name: 'Prestation',
                    original: preview.base.original,
                    discounted: preview.base.discounted,
                    applies: true,
                  }}
                />
              )}

              {/* Variations — always discounted (they define the price) */}
              {preview.variations.map((group, gi) => (
                <div key={gi} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {group.name}
                  </p>
                  <div className="space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                    {group.rows.map((row, ri) => (
                      <PriceLine key={ri} row={row} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Add-on options — discounted only when included */}
              {preview.options.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Options et suppléments
                  </p>
                  <div className="space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                    {preview.options.map((row, oi) => (
                      <PriceLine key={oi} row={row} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
