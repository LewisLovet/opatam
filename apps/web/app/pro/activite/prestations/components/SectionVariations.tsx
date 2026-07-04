'use client';

import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { getServiceMinPrice, formatPrice } from '@booking-app/shared';
import { EditorSection } from './EditorSection';
import { VariationsListEditor } from './VariationsListEditor';
import { OptionsListEditor } from './OptionsListEditor';
import { InfoFieldsListEditor } from './InfoFieldsListEditor';
import type { ServiceFormData } from './types';

interface SectionVariationsProps {
  data: ServiceFormData;
  update: (patch: Partial<ServiceFormData>) => void;
}

/**
 * The variations / options / infos builder. Three blocks:
 *   - Variations: required radio groups that change price & duration
 *   - Options: optional add-ons (each can nest its own variations/infos)
 *   - Infos: purely informative questions with no price impact
 *
 * The Variations block is ALWAYS visible: adding the first variation is what
 * switches the prestation to "price defined by variations" (the pro doesn't
 * have to pre-select a pricing mode up in Essentiel — the flow follows the
 * action, not the other way around). A live "À partir de" recap reflects the
 * cheapest reachable price and pulses when it changes.
 */
export function SectionVariations({ data, update }: SectionVariationsProps) {
  const hasVariations = data.variations.length > 0;
  const minPrice = getServiceMinPrice({
    price: data.price,
    variations: data.variations,
  });

  // Pulse the "À partir de" badge whenever the cheapest price moves, so the
  // pro notices the recap reacting to their edits. Skip the initial render.
  const [badgePulse, setBadgePulse] = useState(false);
  const prevMin = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevMin.current;
    prevMin.current = hasVariations ? minPrice : null;
    if (hasVariations && prev !== null && prev !== minPrice) {
      setBadgePulse(true);
      const t = setTimeout(() => setBadgePulse(false), 1200);
      return () => clearTimeout(t);
    }
  }, [minPrice, hasVariations]);

  const badge = hasVariations ? (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 whitespace-nowrap ${
        badgePulse ? 'animate-editor-flash-ring' : ''
      }`}
    >
      À partir de {formatPrice(minPrice)}
    </span>
  ) : undefined;

  return (
    <div id="section-variations" className="scroll-mt-20">
      <EditorSection
        title="Variations & options"
        description="Laissez le client composer sa prestation — le prix s'ajuste tout seul."
        icon={<Layers className="w-5 h-5" />}
        defaultOpen={false}
        forceOpen={hasVariations}
        badge={badge}
      >
        {/* Variations — always available: adding the first one flips the
            pricing to "Selon les variations" automatically. */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Variations
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
            Un choix que le client <strong>doit</strong> faire et qui définit le prix
            / la durée (ex : Longueur, Type de pose). Le client en choisit un seul par
            variation.
          </p>

          {!hasVariations && (
            <div className="mb-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                <strong>Ex :</strong> «&nbsp;Longueur&nbsp;» — Cheveux courts 35&nbsp;€ ·
                Mi-longs 40&nbsp;€ · Longs 45&nbsp;€
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Dès la première variation, le prix de la prestation passe
                automatiquement en «&nbsp;Selon les variations&nbsp;» — le prix fixe
                saisi plus haut n&apos;est plus utilisé.
              </p>
            </div>
          )}

          <VariationsListEditor
            variations={data.variations}
            onChange={(next) => update({ variations: next })}
          />
        </div>

        {/* Options */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Options
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
            Un ajout <strong>facultatif</strong> (ex : Mèches incluses, Brushing).
            Chaque option peut avoir ses propres variations et infos, visibles
            seulement si le client la coche.
          </p>
          <OptionsListEditor
            options={data.options}
            onChange={(next) => update({ options: next })}
          />
        </div>

        {/* Info fields */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700/60">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Infos à demander
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
            Une question <strong>sans impact sur le prix</strong> (ex : Couleur
            préférée, Allergies).
          </p>
          <InfoFieldsListEditor
            fields={data.infoFields}
            onChange={(next) => update({ infoFields: next })}
          />
        </div>
      </EditorSection>
    </div>
  );
}
