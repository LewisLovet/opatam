'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Eye, Loader2, Pencil, RotateCcw, X } from 'lucide-react';
import {
  computeServiceTotal,
  validateServiceSelections,
  emptyServiceSelections,
  getServiceMinPrice,
  formatPrice,
  formatDuration,
  type ServiceSelections,
} from '@booking-app/shared';
import { ServiceChoicesPicker } from '@/components/booking/ServiceChoicesPicker';
import type { ServiceFormData } from './types';

/**
 * Live "client view" of the prestation. Renders the exact booking-flow
 * picker (ServiceChoicesPicker) against the current form data, with a
 * running total so the pro understands the impact of their config as
 * they build it.
 */
/** The editable blocks a pro can jump back to from the preview. */
export type ServicePreviewSection = 'name' | 'price' | 'variations' | 'options';

export function ServicePreview({
  data,
  embedded = false,
  onClose,
  onEditSection,
  onPublish,
  publishing = false,
}: {
  data: ServiceFormData;
  /** Drop the outer card frame to sit flush inside a modal (mobile). */
  embedded?: boolean;
  /** When provided, a close button is shown in the header (modal use). */
  onClose?: () => void;
  /** Shortcut back to the matching form section — shows a pencil per block. */
  onEditSection?: (section: ServicePreviewSection) => void;
  /** Creation flow: the preview is the mandatory last step, so its CTA
   *  publishes the prestation. */
  onPublish?: () => void;
  publishing?: boolean;
}) {
  const [selections, setSelections] = useState<ServiceSelections>(() =>
    emptyServiceSelections(),
  );

  // Flash a primary ring when the STRUCTURE of the prestation changes (a
  // variation/option/info added or removed) so the pro's eye is drawn to the
  // preview updating. Counts only — flashing on every keystroke would be noise.
  const configSignature = [
    data.variations.length,
    data.variations.reduce((n, v) => n + v.options.length, 0),
    data.options.length,
    data.infoFields.length,
  ].join('/');
  const [flash, setFlash] = useState(false);
  const prevSignature = useRef(configSignature);
  useEffect(() => {
    if (prevSignature.current !== configSignature) {
      prevSignature.current = configSignature;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [configSignature]);

  const total = computeServiceTotal(
    {
      price: data.price,
      duration: data.duration,
      variations: data.variations,
      options: data.options,
    },
    selections,
  );

  const { missing } = validateServiceSelections(
    {
      variations: data.variations,
      options: data.options,
      infoFields: data.infoFields,
    },
    selections,
  );
  const missingSet = new Set(missing);

  // Before the client has answered every required choice, show the
  // minimum reachable price ("À partir de") rather than a misleading
  // partial total. Once complete (or for a plain fixed/range service),
  // show the concrete total.
  const hasChoices =
    data.variations.length > 0 || data.options.length > 0;
  const priceLabel =
    missing.length > 0 && hasChoices
      ? `À partir de ${formatPrice(getServiceMinPrice({ price: data.price, variations: data.variations }))}`
      : formatPrice(total.price);

  /** Pencil sending the pro back to the matching section of the form. */
  const EditPencil = ({ section }: { section: ServicePreviewSection }) =>
    onEditSection ? (
      <button
        type="button"
        onClick={() => onEditSection(section)}
        aria-label="Modifier cette partie"
        title="Modifier cette partie"
        className="flex-shrink-0 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    ) : null;

  /** Small labelled header above a preview block, with its own pencil. */
  const BlockHeader = ({
    label,
    section,
  }: {
    label: string;
    section: ServicePreviewSection;
  }) => (
    <div className="flex items-center gap-2">
      <p className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <EditPencil section={section} />
    </div>
  );

  return (
    <div
      className={`${
        embedded
          ? 'flex flex-col max-h-[85vh] bg-white dark:bg-gray-800'
          : 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-editor-preview-breathe'
      } ${flash ? 'animate-editor-flash-ring' : ''}`}
    >
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
        <Eye className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
          Aperçu client
        </p>
        <button
          type="button"
          onClick={() => setSelections(emptyServiceSelections())}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-1 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Fermer l'aperçu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={`p-4 space-y-4 ${embedded ? 'overflow-y-auto' : ''}`}>
        {onPublish && (
          <p className="rounded-lg bg-primary-50 dark:bg-primary-900/15 border border-primary-200 dark:border-primary-900/40 px-3 py-2 text-xs text-primary-800 dark:text-primary-200">
            Vérifiez la fiche telle que vos clientes la verront, puis publiez.
            Le crayon ramène directement au champ à corriger.
          </p>
        )}

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {data.name || 'Votre prestation'}
            </p>
            {data.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                {data.description}
              </p>
            )}
          </div>
          <EditPencil section="name" />
        </div>

        {onEditSection ? (
          <>
            {data.variations.length > 0 && (
              <div className="space-y-3">
                <BlockHeader label="Variations" section="variations" />
                <ServiceChoicesPicker
                  service={{ variations: data.variations, options: [], infoFields: [] }}
                  selections={selections}
                  onChange={setSelections}
                  missing={missingSet}
                />
              </div>
            )}
            {(data.options.length > 0 || data.infoFields.length > 0) && (
              <div className="space-y-3">
                <BlockHeader label="Options & infos" section="options" />
                <ServiceChoicesPicker
                  service={{
                    variations: [],
                    options: data.options,
                    infoFields: data.infoFields,
                  }}
                  selections={selections}
                  onChange={setSelections}
                  missing={missingSet}
                />
              </div>
            )}
            {!hasChoices && data.infoFields.length === 0 && (
              <ServiceChoicesPicker
                service={{ variations: [], options: [], infoFields: [] }}
                selections={selections}
                onChange={setSelections}
                missing={missingSet}
              />
            )}
          </>
        ) : (
          <ServiceChoicesPicker
            service={{
              variations: data.variations,
              options: data.options,
              infoFields: data.infoFields,
            }}
            selections={selections}
            onChange={setSelections}
            missing={missingSet}
          />
        )}
      </div>

      {/* Total bar — what the client commits to */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
        {missing.length > 0 && (
          <p className="text-xs text-error-600 dark:text-error-400 mb-1.5">
            À choisir : {missing.join(', ')}
          </p>
        )}
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDuration(total.duration)}
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {priceLabel}
          </span>
          <EditPencil section="price" />
        </div>

        {/* Creation flow: publication is confirmed from here. */}
        {onPublish && (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publication…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Publier la prestation
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
