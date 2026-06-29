'use client';

import { Input, Switch } from '@/components/ui';
import { Tag, Check } from 'lucide-react';
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
  excludedIds: [] as string[],
  startsAt: null,
  endsAt: null,
} as const;

function euro(cents: number): string {
  if (cents === 0) return 'Gratuit';
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

/** A "12 € → 9,60 €" line. When `onToggle` is given the whole row is a button
 *  that includes/excludes the line from the promo (checkbox + greyed state). */
function PriceLine({ row, onToggle }: { row: DiscountPreviewRow; onToggle?: () => void }) {
  const reduced = row.applies && row.discounted < row.original;
  const inner = (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 min-w-0">
        {onToggle && (
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              row.applies
                ? 'bg-rose-500 border-rose-500'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {row.applies && <Check className="w-3 h-3 text-white" />}
          </span>
        )}
        <span
          className={`truncate ${
            row.applies ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {row.name}
        </span>
      </span>
      {reduced ? (
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-gray-400 line-through">{euro(row.original)}</span>
          <span className="font-semibold text-rose-600 dark:text-rose-400">{euro(row.discounted)}</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-gray-500 dark:text-gray-400">{euro(row.original)}</span>
          {onToggle && !row.applies && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">non incluse</span>
          )}
        </span>
      )}
    </div>
  );

  if (!onToggle) return inner;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left -mx-1 px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/40 transition-colors"
    >
      {inner}
    </button>
  );
}

/**
 * Per-service promotion: a % off, optionally date-bounded. The promo reduces the
 * base price plus every variation/option — except the lines the pro excludes by
 * tapping them in the live preview. The preview IS the control: the pro sees and
 * picks exactly what goes on sale.
 */
export function SectionPromotion({ data, errors, update }: SectionPromotionProps) {
  const promo = data.discount;
  const enabled = promo !== null;

  const setPromo = (patch: Partial<NonNullable<ServiceFormData['discount']>>) =>
    update({ discount: { ...(promo ?? DEFAULT_PROMO), ...patch } });

  const toggleLine = (id: string) => {
    const ex = promo?.excludedIds ?? [];
    setPromo({ excludedIds: ex.includes(id) ? ex.filter((x) => x !== id) : [...ex, id] });
  };

  const preview =
    enabled && promo
      ? buildServiceDiscountPreview(
          { price: data.price, variations: data.variations, options: data.options },
          promo,
        )
      : null;

  const hasLines =
    !!preview && (preview.variations.length > 0 || preview.options.length > 0);

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

          {/* Live, interactive before/after preview */}
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

              {hasLines && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cliquez une ligne pour l&apos;inclure ou l&apos;exclure de la promo.
                </p>
              )}

              {/* Base (variation-less services) — always discounted */}
              {preview.base && (
                <PriceLine
                  row={{
                    id: null,
                    name: 'Prestation',
                    original: preview.base.original,
                    discounted: preview.base.discounted,
                    applies: true,
                  }}
                />
              )}

              {/* Variations */}
              {preview.variations.map((group, gi) => (
                <div key={gi} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{group.name}</p>
                  <div className="space-y-0.5 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                    {group.rows.map((row) => (
                      <PriceLine key={row.id} row={row} onToggle={() => toggleLine(row.id!)} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Add-on options */}
              {preview.options.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Options et suppléments
                  </p>
                  <div className="space-y-0.5 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                    {preview.options.map((row) => (
                      <PriceLine key={row.id} row={row} onToggle={() => toggleLine(row.id!)} />
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
