/**
 * Re-export of the shared service-choice helpers. The logic now lives in
 * `@booking-app/shared` (so the mobile app reuses it); kept here so existing
 * web imports (`./choiceHelpers`) keep working unchanged.
 */
export {
  moveItem,
  genId,
  newVariationOption,
  newVariation,
  newInfoField,
  newOption,
  sanitizeVariations,
  sanitizeInfoFields,
  sanitizeOptions,
} from '@booking-app/shared';
