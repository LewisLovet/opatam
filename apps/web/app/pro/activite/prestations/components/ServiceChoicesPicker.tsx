'use client';

import { formatPrice, formatDuration } from '@booking-app/shared';
import type {
  Service,
  ServiceVariation,
  ServiceInfoField,
} from '@booking-app/shared';
import type { ServiceSelections } from '@booking-app/shared';

/**
 * The client-facing picker for a prestation's variations / options /
 * infos. Pure controlled component — the parent owns the selections.
 *
 * This is THE booking-flow UI: the editor preview renders it so the pro
 * sees exactly what the client will, and the public reservation page
 * will reuse the very same component when choices are wired in.
 */
interface ServiceChoicesPickerProps {
  service: Pick<
    Service,
    'variations' | 'options' | 'infoFields'
  >;
  selections: ServiceSelections;
  onChange: (next: ServiceSelections) => void;
  /** Names of required choices still missing — highlighted in red. */
  missing?: Set<string>;
}

/**
 * Price/duration tag for a choice. Options are additive (`+12€ · +30min`);
 * variations DEFINE the prestation, so they show plain values (`70€ · 9h`).
 */
function ContribTag({
  price,
  duration,
  additive = true,
}: {
  price: number;
  duration: number;
  additive?: boolean;
}) {
  if (price === 0 && duration === 0) return null;
  const sign = additive ? '+' : '';
  return (
    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
      {price > 0 && `${sign}${formatPrice(price)}`}
      {price > 0 && duration > 0 && ' · '}
      {duration > 0 && `${sign}${formatDuration(duration)}`}
    </span>
  );
}

export function ServiceChoicesPicker({
  service,
  selections,
  onChange,
  missing,
}: ServiceChoicesPickerProps) {
  const variations = service.variations ?? [];
  const options = service.options ?? [];
  const infoFields = service.infoFields ?? [];

  const selectVariation = (variationId: string, optionId: string) =>
    onChange({
      ...selections,
      variations: { ...selections.variations, [variationId]: optionId },
    });

  const toggleOption = (optionId: string) => {
    const nextOptions = { ...selections.options };
    if (nextOptions[optionId]) {
      delete nextOptions[optionId];
    } else {
      nextOptions[optionId] = { nestedVariations: {}, infoValues: {} };
    }
    onChange({ ...selections, options: nextOptions });
  };

  const selectNestedVariation = (
    optionId: string,
    variationId: string,
    choiceId: string,
  ) => {
    const opt = selections.options[optionId];
    if (!opt) return;
    onChange({
      ...selections,
      options: {
        ...selections.options,
        [optionId]: {
          ...opt,
          nestedVariations: { ...opt.nestedVariations, [variationId]: choiceId },
        },
      },
    });
  };

  const setOptionInfo = (optionId: string, fieldId: string, value: string) => {
    const opt = selections.options[optionId];
    if (!opt) return;
    onChange({
      ...selections,
      options: {
        ...selections.options,
        [optionId]: {
          ...opt,
          infoValues: { ...opt.infoValues, [fieldId]: value },
        },
      },
    });
  };

  const setInfo = (fieldId: string, value: string) =>
    onChange({
      ...selections,
      infoValues: { ...selections.infoValues, [fieldId]: value },
    });

  if (variations.length === 0 && options.length === 0 && infoFields.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
        Aucune variation, option ou info — la cliente verra directement le prix de
        base.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Variations (required radios) */}
      {variations.map((variation) => (
        <VariationBlock
          key={variation.id}
          variation={variation}
          selectedId={selections.variations[variation.id]}
          onSelect={(optId) => selectVariation(variation.id, optId)}
          highlight={!!variation.name && missing?.has(variation.name)}
          additive={false}
        />
      ))}

      {/* Options (checkboxes, expandable) */}
      {options.map((option) => {
        const selected = selections.options[option.id];
        return (
          <div key={option.id} className="space-y-3">
            <button
              type="button"
              onClick={() => toggleOption(option.id)}
              className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                  selected
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {selected && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 fill-current">
                    <path d="M10.28 2.28L4 8.56 1.72 6.28a.75.75 0 10-1.06 1.06l2.81 2.81c.3.3.77.3 1.06 0l6.81-6.81a.75.75 0 10-1.06-1.06z" />
                  </svg>
                )}
              </span>
              <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
                {option.name || 'Option'}
              </span>
              <ContribTag price={option.price} duration={option.duration} />
            </button>

            {/* Nested variations + infos, only when the option is checked */}
            {selected && (option.nestedVariations.length > 0 || option.nestedInfoFields.length > 0) && (
              <div className="ml-7 pl-3 border-l-2 border-primary-100 dark:border-primary-900/40 space-y-4">
                {option.nestedVariations.map((nv) => (
                  <VariationBlock
                    key={nv.id}
                    variation={nv}
                    selectedId={selected.nestedVariations[nv.id]}
                    onSelect={(optId) => selectNestedVariation(option.id, nv.id, optId)}
                    highlight={!!nv.name && missing?.has(nv.name)}
                    additive
                  />
                ))}
                {option.nestedInfoFields.map((field) => (
                  <InfoFieldBlock
                    key={field.id}
                    field={field}
                    value={selected.infoValues[field.id] ?? ''}
                    onChange={(v) => setOptionInfo(option.id, field.id, v)}
                    highlight={!!field.name && missing?.has(field.name)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Top-level info fields */}
      {infoFields.map((field) => (
        <InfoFieldBlock
          key={field.id}
          field={field}
          value={selections.infoValues[field.id] ?? ''}
          onChange={(v) => setInfo(field.id, v)}
          highlight={!!field.name && missing?.has(field.name)}
        />
      ))}
    </div>
  );
}

function VariationBlock({
  variation,
  selectedId,
  onSelect,
  highlight,
  additive = false,
}: {
  variation: ServiceVariation;
  selectedId: string | undefined;
  onSelect: (optionId: string) => void;
  highlight?: boolean;
  additive?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-sm font-medium mb-2 ${
          highlight ? 'text-error-600 dark:text-error-400' : 'text-gray-900 dark:text-white'
        }`}
      >
        {variation.name || 'Variation'}
        <span className="text-error-500 ml-0.5">*</span>
      </p>
      {variation.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1 mb-2">
          {variation.description}
        </p>
      )}
      <div className="space-y-2">
        {variation.options.map((opt) => {
          const checked = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                checked
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                  checked ? 'border-primary-600' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {checked && <span className="w-2 h-2 rounded-full bg-primary-600" />}
              </span>
              <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate">
                {opt.name || 'Choix'}
              </span>
              <ContribTag price={opt.price} duration={opt.duration} additive={additive} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoFieldBlock({
  field,
  value,
  onChange,
  highlight,
}: {
  field: ServiceInfoField;
  value: string;
  onChange: (value: string) => void;
  highlight?: boolean;
}) {
  return (
    <div>
      <label
        className={`block text-sm font-medium mb-1.5 ${
          highlight ? 'text-error-600 dark:text-error-400' : 'text-gray-900 dark:text-white'
        }`}
      >
        {field.name || 'Information'}
        {field.required && <span className="text-error-500 ml-0.5">*</span>}
      </label>
      {field.type === 'boolean' ? (
        <div className="flex gap-2">
          {['Oui', 'Non'].map((opt) => {
            const checked = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  checked
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : field.type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Choisir…</option>
          {(field.values ?? [])
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Votre réponse"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      )}
    </div>
  );
}
