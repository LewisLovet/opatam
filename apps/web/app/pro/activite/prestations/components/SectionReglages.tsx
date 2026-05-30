'use client';

import { useState } from 'react';
import { Select, Button } from '@/components/ui';
import { Check, SlidersHorizontal, Plus, Loader2, X } from 'lucide-react';
import { SERVICE_COLORS } from '@booking-app/shared';
import type { ServiceCategory } from '@booking-app/shared';
import { EditorSection } from './EditorSection';
import { DepositSection } from './DepositSection';
import type { ServiceFormData } from './types';

type WithId<T> = { id: string } & T;

const CREATE_CATEGORY = '__create_category__';

const BUFFER_TIME_OPTIONS = [
  { value: '0', label: 'Aucun' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
];

interface SectionReglagesProps {
  data: ServiceFormData;
  errors: Record<string, string>;
  categories: WithId<ServiceCategory>[];
  /** Create a category on the fly; resolves once it's created + selected. */
  onCreateCategory: (name: string) => Promise<WithId<ServiceCategory>>;
  depositsEnabled: boolean;
  defaultDeposit: { percent: number; refundDeadlineHours: number } | null;
  update: (patch: Partial<ServiceFormData>) => void;
}

/**
 * Secondary settings: deposit, buffer time, category and calendar
 * colour. Collapsed by default so the editor stays light for pros who
 * only need the essentials.
 */
export function SectionReglages({
  data,
  errors,
  categories,
  onCreateCategory,
  depositsEnabled,
  defaultDeposit,
  update,
}: SectionReglagesProps) {
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  const submitNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCategoryError('Le nom est requis');
      return;
    }
    setCategoryLoading(true);
    setCategoryError('');
    try {
      await onCreateCategory(name); // creates + selects in the parent
      setCreatingCategory(false);
      setNewCategoryName('');
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setCategoryLoading(false);
    }
  };

  return (
    <EditorSection
      title="Réglages"
      description="Acompte, battement, catégorie et couleur."
      icon={<SlidersHorizontal className="w-5 h-5" />}
      defaultOpen={false}
      forceOpen={!!errors.depositValue}
    >
      {/* Acompte */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Acompte sur cette prestation
        </label>
        <DepositSection
          depositsEnabled={depositsEnabled}
          defaultDeposit={defaultDeposit}
          servicePrice={data.price}
          deposit={data.deposit}
          onChange={(next) => update({ deposit: next })}
          error={errors.depositValue}
        />
      </div>

      {/* Buffer time */}
      <Select
        label="Temps de battement après RDV"
        name="bufferTime"
        value={data.bufferTime.toString()}
        onChange={(e) => update({ bufferTime: parseInt(e.target.value, 10) || 0 })}
        options={BUFFER_TIME_OPTIONS}
        hint="Temps de pause entre deux rendez-vous"
      />

      {/* Category — with on-the-fly creation */}
      <div>
        {creatingCategory ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Nouvelle catégorie
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  setCategoryError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitNewCategory();
                  }
                }}
                placeholder="Ex : Coiffure"
                maxLength={50}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button
                type="button"
                size="sm"
                onClick={submitNewCategory}
                disabled={categoryLoading}
              >
                {categoryLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Créer'
                )}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setCreatingCategory(false);
                  setNewCategoryName('');
                  setCategoryError('');
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {categoryError && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400">
                {categoryError}
              </p>
            )}
          </div>
        ) : (
          <Select
            label="Catégorie"
            name="categoryId"
            value={data.categoryId || ''}
            onChange={(e) => {
              if (e.target.value === CREATE_CATEGORY) {
                setCreatingCategory(true);
                return;
              }
              update({ categoryId: e.target.value || null });
            }}
            options={[
              { value: '', label: 'Sans catégorie' },
              ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              { value: CREATE_CATEGORY, label: '➕ Créer une catégorie…' },
            ]}
          />
        )}
      </div>

      {/* Calendar colour */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Couleur sur le calendrier{' '}
          <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => update({ color: null })}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-dashed ${
              data.color === null
                ? 'border-gray-700 dark:border-gray-300 ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800'
                : 'border-gray-300 dark:border-gray-600 hover:scale-110'
            }`}
            title="Aucune (utiliser la couleur du membre)"
          >
            <span className="text-xs text-gray-500 dark:text-gray-400">∅</span>
          </button>
          {SERVICE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => update({ color })}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                data.color === color
                  ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            >
              {data.color === color && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
    </EditorSection>
  );
}
