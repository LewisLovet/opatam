'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ServiceVariation, ServiceVariationOption } from '@booking-app/shared';
import { NumberField } from '@/components/ui';
import { newVariation, newVariationOption, moveItem } from './choiceHelpers';
import { ReorderControls } from './ReorderControls';
import { useFreshIds } from './useFreshIds';

interface VariationsListEditorProps {
  variations: ServiceVariation[];
  onChange: (next: ServiceVariation[]) => void;
  /** Tighter styling + wording when rendered inside an option. */
  nested?: boolean;
}

/**
 * Manages a list of variations (required, price-impacting radio groups).
 * Reused at the top level of a prestation and nested inside an option.
 * Pure controlled component — all state lives in the parent form.
 */
export function VariationsListEditor({
  variations,
  onChange,
  nested = false,
}: VariationsListEditorProps) {
  const updateVariation = (id: string, patch: Partial<ServiceVariation>) =>
    onChange(variations.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const removeVariation = (id: string) =>
    onChange(variations.filter((v) => v.id !== id));

  const addVariation = () => onChange([...variations, newVariation()]);

  // Freshly added variations pop in so the update is impossible to miss.
  const isFresh = useFreshIds(variations.map((v) => v.id));

  return (
    <div className="space-y-3">
      {variations.map((variation, index) => (
        <div key={variation.id} className={isFresh(variation.id) ? 'animate-editor-pop-in' : undefined}>
          <VariationCard
            variation={variation}
            nested={nested}
            index={index}
            count={variations.length}
            onMove={(dir) => onChange(moveItem(variations, index, dir))}
            onChange={(patch) => updateVariation(variation.id, patch)}
            onRemove={() => removeVariation(variation.id)}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addVariation}
        className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <Plus className="w-4 h-4" />
        {nested ? 'Ajouter une variation à cette option' : 'Ajouter une variation'}
      </button>
    </div>
  );
}

function VariationCard({
  variation,
  nested,
  index,
  count,
  onMove,
  onChange,
  onRemove,
}: {
  variation: ServiceVariation;
  nested: boolean;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onChange: (patch: Partial<ServiceVariation>) => void;
  onRemove: () => void;
}) {
  const updateOption = (id: string, patch: Partial<ServiceVariationOption>) =>
    onChange({
      options: variation.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });

  const removeOption = (id: string) =>
    onChange({ options: variation.options.filter((o) => o.id !== id) });

  const moveOption = (i: number, dir: -1 | 1) =>
    onChange({ options: moveItem(variation.options, i, dir) });

  const addOption = () =>
    onChange({ options: [...variation.options, newVariationOption()] });

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 ${
        nested ? 'bg-gray-50 dark:bg-gray-900/40' : 'bg-white dark:bg-gray-800'
      } p-3 sm:p-4 space-y-3`}
    >
      {/* Variation name + reorder + remove */}
      <div className="flex items-start gap-2">
        <ReorderControls index={index} count={count} onMove={onMove} />
        <input
          type="text"
          value={variation.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Nom de la variation (ex : Longueur)"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
          aria-label="Supprimer la variation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Per-choice hint: values are the full price/duration, not a delta */}
      <p className="text-[11px] text-gray-400 pl-1 -mt-1">
        Prix et durée = le total pour ce choix (pas un supplément).
      </p>

      {/* Options (radio choices) */}
      <div className="space-y-2 pl-1">
        {variation.options.map((opt, optIndex) => (
          <div key={opt.id} className="flex items-center gap-2">
            <ReorderControls
              index={optIndex}
              count={variation.options.length}
              onMove={(dir) => moveOption(optIndex, dir)}
              compact
            />
            <span className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
            <input
              type="text"
              value={opt.name}
              onChange={(e) => updateOption(opt.id, { name: e.target.value })}
              placeholder="Choix (ex : Mi-dos)"
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="relative w-20 flex-shrink-0">
              <NumberField
                value={opt.price / 100}
                onChange={(euros) => updateOption(opt.id, { price: Math.round(euros * 100) })}
                decimal
                min={0}
                placeholder="0"
                className="w-full pl-2.5 pr-5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                €
              </span>
            </div>
            <div className="relative w-20 flex-shrink-0">
              <NumberField
                value={opt.duration}
                onChange={(d) => updateOption(opt.id, { duration: Math.round(d) })}
                min={0}
                placeholder="0"
                className="w-full pl-2.5 pr-7 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                min
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              disabled={variation.options.length <= 1}
              className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
              aria-label="Supprimer le choix"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addOption}
          className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 pl-5"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un choix
        </button>
      </div>
    </div>
  );
}
