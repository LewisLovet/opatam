'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ServiceOption } from '@booking-app/shared';
import { NumberField } from '@/components/ui';
import { newOption, moveItem } from './choiceHelpers';
import { ReorderControls } from './ReorderControls';
import { useFreshIds } from './useFreshIds';
import { VariationsListEditor } from './VariationsListEditor';
import { InfoFieldsListEditor } from './InfoFieldsListEditor';

interface OptionsListEditorProps {
  options: ServiceOption[];
  onChange: (next: ServiceOption[]) => void;
}

/**
 * Manages the list of top-level add-ons (checkboxes). Each option can
 * carry its own nested variations and info fields, only relevant once
 * the client checks it — edited inline, never in a stacked modal.
 */
export function OptionsListEditor({ options, onChange }: OptionsListEditorProps) {
  const updateOption = (id: string, patch: Partial<ServiceOption>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const removeOption = (id: string) => onChange(options.filter((o) => o.id !== id));

  const addOption = () => onChange([...options, newOption()]);

  // Freshly added options pop in so the update is impossible to miss.
  const isFresh = useFreshIds(options.map((o) => o.id));

  return (
    <div className="space-y-3">
      {options.map((option, index) => (
        <div key={option.id} className={isFresh(option.id) ? 'animate-editor-pop-in' : undefined}>
          <OptionCard
            option={option}
            index={index}
            count={options.length}
            onMove={(dir) => onChange(moveItem(options, index, dir))}
            onChange={(patch) => updateOption(option.id, patch)}
            onRemove={() => removeOption(option.id)}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addOption}
        className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <Plus className="w-4 h-4" />
        Ajouter une option
      </button>
    </div>
  );
}

function OptionCard({
  option,
  index,
  count,
  onMove,
  onChange,
  onRemove,
}: {
  option: ServiceOption;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onChange: (patch: Partial<ServiceOption>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4 space-y-3">
      {/* Name + price + duration + reorder + remove */}
      <div className="flex items-start gap-2">
        <ReorderControls index={index} count={count} onMove={onMove} />
        <span className="mt-2.5 w-3.5 h-3.5 rounded border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
        <input
          type="text"
          value={option.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Nom de l'option (ex : Mèches incluses)"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
          aria-label="Supprimer l'option"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 pl-5">
        <div className="relative w-28">
          <NumberField
            value={option.price / 100}
            onChange={(euros) => onChange({ price: Math.round(euros * 100) })}
            decimal
            min={0}
            placeholder="0"
            className="w-full pl-2.5 pr-6 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            €
          </span>
        </div>
        <div className="relative w-28">
          <NumberField
            value={option.duration}
            onChange={(d) => onChange({ duration: Math.round(d) })}
            min={0}
            placeholder="0"
            className="w-full pl-2.5 pr-8 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            min
          </span>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 pl-5 -mt-1">
        Ajouté au prix et à la durée totale quand la cliente coche l&apos;option.
      </p>

      {/* Nested variations */}
      <div className="pl-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Variations de cette option{' '}
          <span className="font-normal">(visibles si l&apos;option est cochée)</span>
        </p>
        <VariationsListEditor
          variations={option.nestedVariations}
          onChange={(next) => onChange({ nestedVariations: next })}
          nested
        />
      </div>

      {/* Nested info fields */}
      <div className="pl-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Infos à demander pour cette option
        </p>
        <InfoFieldsListEditor
          fields={option.nestedInfoFields}
          onChange={(next) => onChange({ nestedInfoFields: next })}
          nested
        />
      </div>
    </div>
  );
}
