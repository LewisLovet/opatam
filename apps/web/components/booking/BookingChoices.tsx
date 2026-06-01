'use client';

import type {
  BookingSelectedVariation,
  BookingSelectedOption,
  BookingSelectedInfo,
} from '@booking-app/shared';

/**
 * Renders the client's denormalised choices (variations / options / info
 * answers) for a single prestation. Used under each prestation line in the
 * web pro (calendar) and admin booking detail views.
 *
 * Renders nothing when there are no choices — legacy bookings (and services
 * without variations) are unaffected. All fields are optional-chained.
 *
 * `formatPrice` takes a price in cents and returns a human string — each
 * caller passes its own formatter (formatBookingPrice / formatPrice).
 */
export function BookingChoices({
  variations,
  options,
  info,
  formatPrice,
}: {
  variations?: BookingSelectedVariation[] | null;
  options?: BookingSelectedOption[] | null;
  info?: BookingSelectedInfo[] | null;
  formatPrice: (cents: number) => string;
}) {
  const hasVariations = (variations?.length ?? 0) > 0;
  const hasOptions = (options?.length ?? 0) > 0;
  const hasInfo = (info?.length ?? 0) > 0;

  if (!hasVariations && !hasOptions && !hasInfo) return null;

  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {/* Variations — "Longueur : Mi-dos" */}
      {variations?.map((v, i) => (
        <div key={`v-${i}`} className="text-gray-500 dark:text-gray-400">
          {v.variationName} :{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {v.optionName}
          </span>
        </div>
      ))}

      {/* Options — "+ Mèches incluses (+12€)" with nested choices */}
      {options?.map((o, i) => (
        <div key={`o-${i}`} className="text-gray-500 dark:text-gray-400">
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              + {o.optionName}
            </span>
            {o.price > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {' '}
                (+{formatPrice(o.price)})
              </span>
            )}
          </div>
          {(o.nestedVariations?.length ?? 0) > 0 ||
          (o.info?.length ?? 0) > 0 ? (
            <div className="ml-3 space-y-0.5">
              {o.nestedVariations?.map((nv, ni) => (
                <div key={`nv-${ni}`} className="text-gray-500 dark:text-gray-400">
                  {nv.variationName} :{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {nv.optionName}
                  </span>
                </div>
              ))}
              {o.info?.map((inf, ii) => (
                <div key={`oi-${ii}`} className="text-gray-500 dark:text-gray-400">
                  {inf.label} :{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {inf.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      {/* Top-level info answers — "Allergies ? : Non" */}
      {info?.map((inf, i) => (
        <div key={`i-${i}`} className="text-gray-500 dark:text-gray-400">
          {inf.label} :{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {inf.value}
          </span>
        </div>
      ))}
    </div>
  );
}
