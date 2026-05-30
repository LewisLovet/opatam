/**
 * Service pricing & duration computations for the variations / options
 * system. Pure functions — no Firebase, no React, no platform deps.
 *
 * Used by:
 *   - the admin wizard's Step 5 preview (live recap of what the
 *     client will see)
 *   - the booking flow (sticky total at the bottom of the service
 *     picker)
 *   - the booking creation endpoint (final price computation + the
 *     denormalised selections written onto the Booking doc)
 *   - the public profile fiche ("À partir de X €" minimum-price
 *     display)
 *
 * Formula:
 *   - When the service HAS top-level variations, the chosen variation
 *     DEFINES the prestation — the base price/duration is NOT used (a
 *     "Knotless Braids" has no standalone 60-min base; the length
 *     variation carries the whole price & duration):
 *
 *       total = Σ chosen top-level variation prices
 *             + Σ checked top-level option prices (+ nested)
 *
 *   - When the service has NO variations, the base price/duration is
 *     the starting point and options simply add on top:
 *
 *       total = service.price + Σ checked option prices (+ nested)
 *
 * `duration` follows the same shape with minutes instead of cents.
 * Options are always additive (+price / +duration on the total).
 */
import type {
  Service,
  ServiceVariation,
  ServiceOption,
  BookingSelectedVariation,
  BookingSelectedOption,
} from '../types';

/**
 * The state object the booking UI keeps while the client is making
 * choices. Maps to "what the client has clicked so far".
 *
 * - `variations[variationId] = optionId` for each TOP-LEVEL variation
 *   the client has answered.
 * - `options[optionId]` is present only when the client has toggled
 *   the add-on ON. Inside, `nestedVariations[varId] = optId` for the
 *   nested radios and `infoValues[fieldId] = value` for nested infos.
 * - `infoValues[fieldId] = value` for TOP-LEVEL info fields.
 *
 * Initial state on opening the picker: empty objects. The UI fills
 * them as the user clicks, and we recompute the total on every tick.
 */
export interface ServiceSelections {
  variations: Record<string, string>;
  options: Record<
    string,
    {
      nestedVariations: Record<string, string>;
      infoValues: Record<string, string>;
    }
  >;
  infoValues: Record<string, string>;
}

/** A fresh empty selections object — handy as a useState initial. */
export function emptyServiceSelections(): ServiceSelections {
  return { variations: {}, options: {}, infoValues: {} };
}

/**
 * Compute the final price + duration of a service given the client's
 * current selections. Missing / unchecked items contribute 0. Returns
 * the service's base price + duration when no selections exist
 * (legacy services). Safe to call on every keystroke / click —
 * iterates the static service definition, no allocation churn.
 */
export function computeServiceTotal(
  service: Pick<Service, 'price' | 'duration' | 'variations' | 'options'>,
  selections: ServiceSelections,
): { price: number; duration: number } {
  // When variations exist they DEFINE the prestation, so the base
  // price/duration is dropped (it only applies to variation-less
  // services). Options always add on top of whatever the variations set.
  const hasVariations = (service.variations?.length ?? 0) > 0;
  let price = hasVariations ? 0 : service.price;
  let duration = hasVariations ? 0 : service.duration;

  for (const variation of service.variations ?? []) {
    const chosenId = selections.variations[variation.id];
    if (!chosenId) continue;
    const chosen = variation.options.find((o) => o.id === chosenId);
    if (!chosen) continue;
    price += chosen.price;
    duration += chosen.duration;
  }

  for (const option of service.options ?? []) {
    const selOpt = selections.options[option.id];
    if (!selOpt) continue; // not checked
    price += option.price;
    duration += option.duration;
    for (const variation of option.nestedVariations) {
      const chosenId = selOpt.nestedVariations[variation.id];
      if (!chosenId) continue;
      const chosen = variation.options.find((o) => o.id === chosenId);
      if (!chosen) continue;
      price += chosen.price;
      duration += chosen.duration;
    }
  }

  return { price, duration };
}

/**
 * Pre-flight validation before letting the client move on to the
 * slot picker. Returns the list of REQUIRED choices the client hasn't
 * filled — empty list = ready to go.
 *
 * Required = every top-level variation, every nested variation of a
 * checked option, every `required: true` info field at the matching
 * scope. Options themselves are never required (they're add-ons).
 */
export function validateServiceSelections(
  service: Pick<Service, 'variations' | 'options' | 'infoFields'>,
  selections: ServiceSelections,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const variation of service.variations ?? []) {
    if (!selections.variations[variation.id]) missing.push(variation.name);
  }

  for (const field of service.infoFields ?? []) {
    if (field.required && !selections.infoValues[field.id]) missing.push(field.name);
  }

  for (const option of service.options ?? []) {
    const selOpt = selections.options[option.id];
    if (!selOpt) continue; // unchecked options don't require their nested fields
    for (const variation of option.nestedVariations) {
      if (!selOpt.nestedVariations[variation.id]) missing.push(variation.name);
    }
    for (const field of option.nestedInfoFields) {
      if (field.required && !selOpt.infoValues[field.id]) missing.push(field.name);
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Denormalise the in-memory selections into the array shape we
 * persist on the Booking doc. Every name / price / duration is
 * frozen at creation time so the booking remains readable even if
 * the pro later renames or deletes a variation.
 */
export function buildBookingSelections(
  service: Pick<Service, 'variations' | 'options' | 'infoFields'>,
  selections: ServiceSelections,
): {
  selectedVariations: BookingSelectedVariation[];
  selectedOptions: BookingSelectedOption[];
  selectedInfoValues: Record<string, string>;
} {
  const selectedVariations: BookingSelectedVariation[] = [];
  for (const variation of service.variations ?? []) {
    const chosenId = selections.variations[variation.id];
    if (!chosenId) continue;
    const chosen = variation.options.find((o) => o.id === chosenId);
    if (!chosen) continue;
    selectedVariations.push({
      variationId: variation.id,
      variationName: variation.name,
      optionId: chosen.id,
      optionName: chosen.name,
      price: chosen.price,
      duration: chosen.duration,
    });
  }

  const selectedOptions: BookingSelectedOption[] = [];
  for (const option of service.options ?? []) {
    const selOpt = selections.options[option.id];
    if (!selOpt) continue;
    const nested: BookingSelectedVariation[] = [];
    for (const variation of option.nestedVariations) {
      const chosenId = selOpt.nestedVariations[variation.id];
      if (!chosenId) continue;
      const chosen = variation.options.find((o) => o.id === chosenId);
      if (!chosen) continue;
      nested.push({
        variationId: variation.id,
        variationName: variation.name,
        optionId: chosen.id,
        optionName: chosen.name,
        price: chosen.price,
        duration: chosen.duration,
      });
    }
    selectedOptions.push({
      optionId: option.id,
      optionName: option.name,
      price: option.price,
      duration: option.duration,
      nestedVariations: nested,
      infoValues: { ...selOpt.infoValues },
    });
  }

  // Filter out empty answers so the persisted record stays tidy.
  const selectedInfoValues: Record<string, string> = {};
  for (const field of service.infoFields ?? []) {
    const value = selections.infoValues[field.id];
    if (value !== undefined && value !== '') {
      selectedInfoValues[field.id] = value;
    }
  }

  return { selectedVariations, selectedOptions, selectedInfoValues };
}

/**
 * Compute the smallest price a client could conceivably pay for the
 * service. Used by the public profile fiche to render "À partir de
 * X €" when variations exist. For each top-level variation we take
 * the cheapest option; options (add-ons) are skipped because the
 * client can always uncheck them.
 *
 * Returns `service.price` for services without variations.
 */
export function getServiceMinPrice(
  service: Pick<Service, 'price' | 'variations'>,
): number {
  const variations = service.variations ?? [];
  // No variations → the base price is the price. With variations the
  // base is dropped and the cheapest reachable combination wins.
  if (variations.length === 0) return service.price;
  let min = 0;
  for (const variation of variations) {
    if (variation.options.length === 0) continue;
    min += Math.min(...variation.options.map((o) => o.price));
  }
  return min;
}

/** Sister helper for duration — minimum duration a service could
 *  take. Same logic. Used by the slot picker on the public fiche
 *  when no concrete choice is made yet, to estimate availability. */
export function getServiceMinDuration(
  service: Pick<Service, 'duration' | 'variations'>,
): number {
  const variations = service.variations ?? [];
  if (variations.length === 0) return service.duration;
  let min = 0;
  for (const variation of variations) {
    if (variation.options.length === 0) continue;
    min += Math.min(...variation.options.map((o) => o.duration));
  }
  return min;
}

/** `true` if the service has ANY variation / option / info field —
 *  i.e. the client needs the picker UI, not just a flat description. */
export function serviceHasChoices(
  service: Pick<Service, 'variations' | 'options' | 'infoFields'>,
): boolean {
  return (
    (service.variations?.length ?? 0) > 0 ||
    (service.options?.length ?? 0) > 0 ||
    (service.infoFields?.length ?? 0) > 0
  );
}

// Re-export the variation / option shapes by reference so callers
// only need one import. (Pure convenience — they're already typed
// in '../types'.)
export type { ServiceVariation, ServiceOption };
