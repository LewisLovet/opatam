'use client';

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
 * A live "À partir de" recap reflects the cheapest reachable price.
 */
export function SectionVariations({ data, update }: SectionVariationsProps) {
  const hasVariations = data.variations.length > 0;
  const minPrice = getServiceMinPrice({
    price: data.price,
    variations: data.variations,
  });

  const badge = hasVariations ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 whitespace-nowrap">
      À partir de {formatPrice(minPrice)}
    </span>
  ) : undefined;

  return (
    <EditorSection
      title="Variations & options"
      description="Laissez le client composer sa prestation — le prix s'ajuste tout seul."
      icon={<Layers className="w-5 h-5" />}
      defaultOpen={false}
      forceOpen={hasVariations}
      badge={badge}
    >
      {/* Variations — only when the prestation is in "Selon les variations"
          mode (opted into via Prix & durée in Essentiel). */}
      {hasVariations && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Variations
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
            Un choix que le client <strong>doit</strong> faire et qui définit le prix
            / la durée (ex : Longueur, Type de pose). Le client en choisit un seul par
            variation.
          </p>
          <VariationsListEditor
            variations={data.variations}
            onChange={(next) => update({ variations: next })}
          />
        </div>
      )}

      {/* Options */}
      <div className={hasVariations ? 'pt-4 border-t border-gray-100 dark:border-gray-700/60' : ''}>
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
  );
}
