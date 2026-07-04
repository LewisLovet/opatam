'use client';

import { useState } from 'react';
import { Input, Textarea, ConfirmDialog } from '@/components/ui';
import { ClipboardList, Layers } from 'lucide-react';
import { EditorSection } from './EditorSection';
import { ServicePhotoPicker } from './ServicePhotoPicker';
import { newVariation } from './choiceHelpers';
import type { ServiceFormData } from './types';

interface SectionEssentielProps {
  data: ServiceFormData;
  errors: Record<string, string>;
  isEditing: boolean;
  update: (patch: Partial<ServiceFormData>) => void;
}

type SimpleMode = 'fixed' | 'free';
type PriceMode = SimpleMode | 'variations';

const PRICE_MODES: { id: PriceMode; label: string }[] = [
  { id: 'fixed', label: 'Prix fixe' },
  { id: 'free', label: 'Gratuit' },
  { id: 'variations', label: 'Selon les variations' },
];

/** Initial simple sub-mode (when the service has no variations). Price
 *  ranges are no longer authored here — a varying price is expressed via
 *  variations — so a legacy ranged service is shown as a fixed price. */
function initialSimpleMode(data: ServiceFormData, isEditing: boolean): SimpleMode {
  if (isEditing && data.price === 0 && data.priceMax === null) return 'free';
  return 'fixed';
}

/**
 * The always-open core of the editor: name, description, photo, and the
 * "Prix & durée" decision. Either the prestation has a fixed/range/free
 * price + duration, OR it's defined by variations — in which case the
 * base price & duration are hidden (the chosen variation sets them).
 */
export function SectionEssentiel({
  data,
  errors,
  isEditing,
  update,
}: SectionEssentielProps) {
  const isVariations = data.variations.length > 0;
  const [simpleMode, setSimpleMode] = useState<SimpleMode>(() =>
    initialSimpleMode(data, isEditing),
  );
  // Confirmation before clearing configured variations on a mode switch.
  const [pendingSimple, setPendingSimple] = useState<SimpleMode | null>(null);

  const activeMode: PriceMode = isVariations ? 'variations' : simpleMode;

  const priceInEuros = data.price / 100;

  const applySimple = (mode: SimpleMode) => {
    setSimpleMode(mode);
    if (mode === 'free') update({ variations: [], price: 0, priceMax: null });
    else update({ variations: [], priceMax: null });
  };

  const selectMode = (mode: PriceMode) => {
    if (mode === activeMode) return;
    if (mode === 'variations') {
      // Shortcut: seed one empty variation and bring the pro to the builder
      // below (the section force-opens as soon as a variation exists).
      update({
        variations: data.variations.length ? data.variations : [newVariation()],
        priceMax: null,
      });
      setTimeout(() => {
        document
          .getElementById('section-variations')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      return;
    }
    // Switching to a simple mode clears variations — confirm if any exist.
    if (isVariations) setPendingSimple(mode);
    else applySimple(mode);
  };

  return (
    <EditorSection
      title="Essentiel"
      description="Les informations indispensables pour publier la prestation."
      icon={<ClipboardList className="w-5 h-5" />}
      collapsible={false}
    >
      <Input
        label="Nom de la prestation"
        name="name"
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Ex: Coupe femme"
        error={errors.name}
        required
      />

      <Textarea
        label="Description"
        name="description"
        value={data.description || ''}
        onChange={(e) => update({ description: e.target.value || null })}
        placeholder="Décrivez cette prestation..."
        rows={3}
        hint="Optionnel — visible par les clients lors de la réservation"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Photo <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <ServicePhotoPicker
          photoURL={data.photoURL}
          onChange={(url) => update({ photoURL: url })}
        />
      </div>

      {/* Prix & durée — single decision, variations-aware */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Prix & durée
        </label>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-900">
          {PRICE_MODES.map((m) => {
            const active = activeMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {activeMode === 'variations' ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary-200 dark:border-primary-900/40 bg-primary-50/60 dark:bg-primary-900/15 px-3 py-2.5">
            <Layers className="w-4 h-4 mt-0.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <p className="text-xs text-primary-800 dark:text-primary-200">
              Le prix et la durée sont définis par la variation choisie par la
              cliente. Configurez-les dans la section{' '}
              <strong>Variations &amp; options</strong> ci-dessous.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Durée (minutes)"
                name="duration"
                numericValue={data.duration}
                onNumericChange={(d) => update({ duration: Math.round(d) })}
                min={5}
                max={480}
                hint="De 5 min à 8h"
                required
              />
              {activeMode !== 'free' && (
                <Input
                  label="Prix (€)"
                  name="price"
                  numericValue={priceInEuros}
                  onNumericChange={(euros) => update({ price: Math.round(euros * 100) })}
                  decimal
                  placeholder="0"
                  min={0}
                  error={errors.price}
                  required
                />
              )}
            </div>
            {activeMode === 'free' && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Cette prestation sera affichée comme <strong>gratuite</strong>.
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingSimple !== null}
        onClose={() => setPendingSimple(null)}
        onConfirm={() => {
          const mode = pendingSimple;
          setPendingSimple(null);
          if (mode) applySimple(mode);
        }}
        title="Changer le mode de prix ?"
        message="Les variations que vous avez configurées seront supprimées."
        confirmLabel="Continuer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </EditorSection>
  );
}
