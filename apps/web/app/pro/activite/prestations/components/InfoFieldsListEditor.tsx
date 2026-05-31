'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ServiceInfoField } from '@booking-app/shared';
import { newInfoField, moveItem } from './choiceHelpers';
import { ReorderControls } from './ReorderControls';

interface InfoFieldsListEditorProps {
  fields: ServiceInfoField[];
  onChange: (next: ServiceInfoField[]) => void;
  nested?: boolean;
}

const FIELD_TYPES: { id: ServiceInfoField['type']; label: string }[] = [
  { id: 'text', label: 'Texte libre' },
  { id: 'boolean', label: 'Oui / Non' },
  { id: 'select', label: 'Liste de choix' },
];

/**
 * Manages a list of purely-informative questions (no price impact):
 * free text, a Oui/Non toggle, or a list of choices. Reused at the top
 * level and nested inside an option.
 */
export function InfoFieldsListEditor({
  fields,
  onChange,
  nested = false,
}: InfoFieldsListEditorProps) {
  const updateField = (id: string, patch: Partial<ServiceInfoField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const removeField = (id: string) => onChange(fields.filter((f) => f.id !== id));

  const addField = () => onChange([...fields, newInfoField()]);

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <InfoFieldCard
          key={field.id}
          field={field}
          nested={nested}
          index={index}
          count={fields.length}
          onMove={(dir) => onChange(moveItem(fields, index, dir))}
          onChange={(patch) => updateField(field.id, patch)}
          onRemove={() => removeField(field.id)}
        />
      ))}

      <button
        type="button"
        onClick={addField}
        className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
      >
        <Plus className="w-4 h-4" />
        {nested ? 'Ajouter une info à cette option' : 'Ajouter une info à demander'}
      </button>
    </div>
  );
}

function InfoFieldCard({
  field,
  nested,
  index,
  count,
  onMove,
  onChange,
  onRemove,
}: {
  field: ServiceInfoField;
  nested: boolean;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onChange: (patch: Partial<ServiceInfoField>) => void;
  onRemove: () => void;
}) {
  const values = field.values ?? [];

  const setValue = (i: number, v: string) =>
    onChange({ values: values.map((val, idx) => (idx === i ? v : val)) });
  const removeValue = (i: number) =>
    onChange({ values: values.filter((_, idx) => idx !== i) });
  const addValue = () => onChange({ values: [...values, ''] });
  const moveValue = (i: number, dir: -1 | 1) =>
    onChange({ values: moveItem(values, i, dir) });

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 ${
        nested ? 'bg-gray-50 dark:bg-gray-900/40' : 'bg-white dark:bg-gray-800'
      } p-3 sm:p-4 space-y-3`}
    >
      <div className="flex items-start gap-2">
        <ReorderControls index={index} count={count} onMove={onMove} />
        <input
          type="text"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Question (ex : Couleur préférée)"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
          aria-label="Supprimer la question"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Type toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900">
          {FIELD_TYPES.map((t) => {
            const active = field.type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onChange({
                    type: t.id,
                    // Seed an empty pair of choices when switching to a list.
                    values: t.id === 'select' && values.length === 0 ? ['', ''] : values,
                  })
                }
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  active
                    ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Required toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">Obligatoire</span>
        </label>
      </div>

      {/* Per-choice list editor (only for 'select') */}
      {field.type === 'select' && (
        <div className="space-y-2">
          {values.map((val, i) => (
            <div key={i} className="flex items-center gap-2">
              <ReorderControls
                index={i}
                count={values.length}
                onMove={(dir) => moveValue(i, dir)}
                compact
              />
              <input
                type="text"
                value={val}
                onChange={(e) => setValue(i, e.target.value)}
                placeholder={`Choix ${i + 1}`}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => removeValue(i)}
                disabled={values.length <= 1}
                className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                aria-label="Supprimer le choix"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addValue}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 pl-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un choix
          </button>
        </div>
      )}
    </div>
  );
}
