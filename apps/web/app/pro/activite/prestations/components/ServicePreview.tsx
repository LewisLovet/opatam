'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, RotateCcw, X } from 'lucide-react';
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
export function ServicePreview({
  data,
  embedded = false,
  onClose,
}: {
  data: ServiceFormData;
  /** Drop the outer card frame to sit flush inside a modal (mobile). */
  embedded?: boolean;
  /** When provided, a close button is shown in the header (modal use). */
  onClose?: () => void;
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

  return (
    <div
      className={`${
        embedded
          ? 'flex flex-col max-h-[85vh] bg-white dark:bg-gray-800'
          : 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden'
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
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {data.name || 'Votre prestation'}
          </p>
          {data.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {data.description}
            </p>
          )}
        </div>

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
      </div>

      {/* Total bar — what the client commits to */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
        {missing.length > 0 && (
          <p className="text-xs text-error-600 dark:text-error-400 mb-1.5">
            À choisir : {missing.join(', ')}
          </p>
        )}
        <div className="flex items-end justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDuration(total.duration)}
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {priceLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
