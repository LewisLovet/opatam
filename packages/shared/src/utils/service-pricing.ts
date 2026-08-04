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
  ServiceDiscount,
  BookingSelectedVariation,
  BookingSelectedOption,
  BookingSelectedInfo,
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
  let variationDuration = 0;

  for (const variation of service.variations ?? []) {
    const chosenId = selections.variations[variation.id];
    if (!chosenId) continue;
    const chosen = variation.options.find((o) => o.id === chosenId);
    if (!chosen) continue;
    price += chosen.price;
    variationDuration += chosen.duration;
  }

  // Beaucoup de pros créent des variations qui ne changent QUE le prix et
  // laissent les durées à 0 (« simple / double / triple », même temps de
  // pose). Sans ce repli, la durée de base étant écartée, la prestation
  // durait ZÉRO minute : des réservations de 0 min existent en base.
  // Le prix, lui, ne retombe PAS sur la base : une prestation gratuite est
  // un cas légitime, alors qu'un rendez-vous de durée nulle n'en est
  // jamais un.
  duration += hasVariations
    ? variationDuration > 0
      ? variationDuration
      : service.duration
    : 0;

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
  selectedInfo: BookingSelectedInfo[];
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
    // Labelled nested info answers (question + answer) for this option.
    const optionInfo: BookingSelectedInfo[] = [];
    for (const field of option.nestedInfoFields) {
      const value = selOpt.infoValues[field.id];
      if (value !== undefined && value !== '') {
        optionInfo.push({ fieldId: field.id, label: field.name, value });
      }
    }

    selectedOptions.push({
      optionId: option.id,
      optionName: option.name,
      price: option.price,
      duration: option.duration,
      nestedVariations: nested,
      infoValues: { ...selOpt.infoValues },
      info: optionInfo,
    });
  }

  // Filter out empty answers so the persisted record stays tidy. We keep
  // BOTH the id→value map (back-compat) and a labelled array (for display
  // without re-fetching the service: emails, calendar, réservations…).
  const selectedInfoValues: Record<string, string> = {};
  const selectedInfo: BookingSelectedInfo[] = [];
  for (const field of service.infoFields ?? []) {
    const value = selections.infoValues[field.id];
    if (value !== undefined && value !== '') {
      selectedInfoValues[field.id] = value;
      selectedInfo.push({ fieldId: field.id, label: field.name, value });
    }
  }

  return { selectedVariations, selectedOptions, selectedInfoValues, selectedInfo };
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
  // Variations sans durée (elles ne font varier que le prix) : la durée
  // reste celle de la prestation. Même repli que `computeServiceTotal`,
  // sinon l'affichage « à partir de » annoncerait 0 minute.
  return min > 0 ? min : service.duration;
}

/** Bounds the PERSISTED base duration/price must respect — mirrors
 *  `createServiceSchema` (5 min ≤ duration ≤ 24 h, price ≤ 10 000 €).
 *
 *  The duration ceiling matches the one on variation options ON PURPOSE. It
 *  used to be 8 h: a prestation whose SHORTEST combination exceeded 8 h saw
 *  its derived base duration truncated, and `getAvailableSlots` — which
 *  falls back to that stored duration before the client has chosen his
 *  options — offered slots far too short for the real prestation. */
export const SERVICE_BASE_DURATION_MIN = 5;
export const SERVICE_BASE_DURATION_MAX = 1440;
export const SERVICE_BASE_PRICE_MAX = 1_000_000;

/**
 * The base `price` / `duration` to PERSIST on a service.
 *
 * With variations the pro never types them (the fields are hidden — the
 * variations define the prestation), so we derive them from the CHEAPEST
 * reachable combination: the stored values become the "à partir de" shown on
 * cards, lists and the public fiche. Without variations the typed values are
 * returned untouched — a free prestation stays free.
 *
 * Clamped so the stored document always satisfies the schema even in the
 * degenerate cases: a variation with no option, or every option at 0 min,
 * would otherwise derive a 0-minute duration and be rejected.
 */
export function deriveServiceBasePricing(
  service: Pick<Service, 'price' | 'duration' | 'variations'>,
): { price: number; duration: number } {
  const variations = service.variations ?? [];
  if (variations.length === 0) {
    return { price: service.price, duration: service.duration };
  }
  // Prix : base volontairement à 0 — les variations définissent la
  // prestation, et une prestation gratuite doit rester gratuite.
  // Durée : on transmet la vraie durée, car elle sert de REPLI quand les
  // variations ne portent aucune durée (voir getServiceMinDuration).
  const price = getServiceMinPrice({ price: 0, variations });
  const duration = getServiceMinDuration({ duration: service.duration, variations });
  return {
    price: Math.min(SERVICE_BASE_PRICE_MAX, Math.max(0, Math.round(price) || 0)),
    duration: Math.min(
      SERVICE_BASE_DURATION_MAX,
      Math.max(SERVICE_BASE_DURATION_MIN, Math.round(duration) || 0),
    ),
  };
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

// ─── Promotions / discounts ──────────────────────────────────────────────
//
// A promo can live on a service (`service.discount`) or shop-wide
// (`provider.settings.globalDiscount`). The per-service one wins. A promo is
// only active within its optional date window. Applying it at the
// effective-price layer makes the discount propagate automatically to the
// deposit (resolveDeposit runs on the effective price), Stripe charge, emails
// and revenue stats — none of those need to know about promos.
//
// Deux formes : POURCENTAGE (`percent`) ou MONTANT FIXE en centimes
// (`amount`), jamais les deux — le schéma refuse la combinaison. Tout passe
// par `getDiscountReduction`, ce qui garantit que le prix affiché, le prix
// facturé et l'acompte parlent de la même remise.

/** Local YYYY-MM-DD (timezone-safe — matches the window strings). */
function discountDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** `true` si la promo porte une valeur exploitable, sous l'une ou l'autre
 *  forme. Une promo sans valeur n'est pas une promo. */
export function isDiscountValueUsable(
  discount: Pick<ServiceDiscount, 'percent' | 'amount'> | null | undefined,
): boolean {
  if (!discount) return false;
  const pct = discount.percent;
  if (typeof pct === 'number' && pct > 0 && pct <= 100) return true;
  const amt = discount.amount;
  return typeof amt === 'number' && amt > 0;
}

/** `true` quand la promo est un montant fixe (et non un pourcentage). */
export function isAmountDiscount(
  discount: Pick<ServiceDiscount, 'amount'> | null | undefined,
): boolean {
  return typeof discount?.amount === 'number' && discount.amount > 0;
}

/**
 * LA réduction à retirer d'un sous-total remisable — point de passage unique
 * des deux formes de promo.
 *
 * Le montant fixe est PLAFONNÉ au sous-total : sans ce plafond, « −20 € » sur
 * une prestation à 15 € donnerait un prix négatif. C'est aussi ce qui rend
 * inutiles les `Math.max(0, …)` défensifs chez les appelants.
 *
 * Quand les deux champs sont renseignés — impossible via le schéma, mais un
 * document écrit à la main pourrait l'être — le montant l'emporte, par choix
 * explicite plutôt que par hasard d'implémentation.
 */
export function getDiscountReduction(
  discountable: number,
  discount: Pick<ServiceDiscount, 'percent' | 'amount'> | null | undefined,
): number {
  if (!discount || discountable <= 0) return 0;
  if (isAmountDiscount(discount)) return Math.min(discount.amount!, discountable);
  const pct = discount.percent ?? 0;
  if (!(pct > 0)) return 0;
  return Math.round((discountable * pct) / 100);
}

/**
 * Libellé court de la remise pour les pastilles : « −20 % » ou « −10 € ».
 * Retourne null quand la promo n'a pas de valeur exploitable.
 *
 * Le formatage monétaire est fait ici avec `Intl` plutôt qu'en réutilisant
 * `formatPrice` : ce module est réexporté par `utils/index`, l'importer
 * créerait un cycle.
 */
export function formatDiscountBadge(
  discount: Pick<ServiceDiscount, 'percent' | 'amount'> | null | undefined,
  locale = 'fr-FR',
  currency = 'EUR',
): string | null {
  if (!isDiscountValueUsable(discount)) return null;
  if (isAmountDiscount(discount)) {
    const value = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: discount!.amount! % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(discount!.amount! / 100);
    return `−${value}`;
  }
  return `−${discount!.percent}%`;
}

/** The discount if it's currently active (valeur exploitable + inside its
 *  window), else null. */
export function getActiveDiscount(
  discount: ServiceDiscount | null | undefined,
  now: Date = new Date(),
): ServiceDiscount | null {
  if (!isDiscountValueUsable(discount)) return null;
  const today = discountDateKey(now);
  if (discount!.startsAt && today < discount!.startsAt) return null;
  if (discount!.endsAt && today > discount!.endsAt) return null;
  return discount!;
}

/** Effective discount for a service: its own active promo wins; otherwise the
 *  provider's global promo (if active) applies. */
export function resolveServiceDiscount(
  service: Pick<Service, 'discount'>,
  globalDiscount: ServiceDiscount | null | undefined,
  now: Date = new Date(),
): ServiceDiscount | null {
  return getActiveDiscount(service.discount, now) ?? getActiveDiscount(globalDiscount, now);
}

/**
 * Apply an (already-resolved, active) discount to a gross total.
 * `basePrice` = the flat service.price — the discountable amount when
 * `includeExtras` is false (variations/options keep their full price).
 */
export function applyDiscount(
  grossTotal: number,
  basePrice: number,
  discount: ServiceDiscount | null,
): {
  price: number;
  original: number;
  discountPercent: number | null;
  discountAmount: number | null;
} {
  if (!discount) {
    return {
      price: grossTotal,
      original: grossTotal,
      discountPercent: null,
      discountAmount: null,
    };
  }
  const discountable = discount.includeExtras ? grossTotal : Math.min(basePrice, grossTotal);
  const reduction = getDiscountReduction(discountable, discount);
  return {
    price: Math.max(0, grossTotal - reduction),
    original: grossTotal,
    ...describeDiscount(discount),
  };
}

/**
 * La forme de la promo, telle que la restituent les fonctions de calcul.
 *
 * `discountAmount` est le MONTANT FIXE DE LA PROMO en centimes, pas l'économie
 * réalisée — celle-ci vaut toujours `original - price`. La distinction compte
 * pour les pastilles : « −10 € » doit rester « −10 € » même quand la
 * prestation ne coûte que 8 € et que l'économie réelle est de 8 €.
 */
function describeDiscount(discount: ServiceDiscount | null): {
  discountPercent: number | null;
  discountAmount: number | null;
} {
  if (!discount) return { discountPercent: null, discountAmount: null };
  if (isAmountDiscount(discount)) {
    return { discountPercent: null, discountAmount: discount.amount! };
  }
  return { discountPercent: discount.percent ?? null, discountAmount: null };
}

/**
 * The set of line ids (variation options + add-on options) NOT reduced by the
 * promo. Source of truth = `discount.excludedIds`; falls back to the legacy
 * `includeExtras === false` (= exclude every add-on option) for old data that
 * predates per-line control.
 */
export function resolveExcludedIds(
  service: Pick<Service, 'options'>,
  discount: Pick<ServiceDiscount, 'excludedIds' | 'includeExtras'> | null | undefined,
): Set<string> {
  if (!discount) return new Set();
  if (discount.excludedIds) return new Set(discount.excludedIds);
  if (discount.includeExtras === false) {
    const ids: string[] = [];
    for (const o of service.options ?? []) {
      ids.push(o.id);
      for (const v of o.nestedVariations) for (const opt of v.options) ids.push(opt.id);
    }
    return new Set(ids);
  }
  return new Set();
}

/**
 * Effective (discounted) price + duration for a service given the client's
 * selections + the promo context. THE entry point for the booking flow recap
 * and the server snapshot. `discountPercent` is null when no promo is active.
 *
 * The promo reduces the base price (variation-less services) plus every chosen
 * variation option and every checked add-on option whose id is NOT in the
 * discount's `excludedIds`.
 */
export function computeDiscountedTotal(
  service: Pick<Service, 'price' | 'duration' | 'variations' | 'options' | 'discount'>,
  selections: ServiceSelections,
  globalDiscount: ServiceDiscount | null | undefined = null,
  now: Date = new Date(),
): {
  price: number;
  original: number;
  duration: number;
  discountPercent: number | null;
  discountAmount: number | null;
} {
  const discount = resolveServiceDiscount(service, globalDiscount, now);
  const excluded = resolveExcludedIds(service, discount);
  const hasVariations = (service.variations?.length ?? 0) > 0;

  let original = 0;
  let discountable = 0;
  let duration = 0;

  // Base — only when there are no variations (else the variations define it).
  // Always discountable (it's the prestation itself).
  if (!hasVariations) {
    original += service.price;
    duration += service.duration;
    if (discount) discountable += service.price;
  }

  for (const variation of service.variations ?? []) {
    const chosen = variation.options.find((o) => o.id === selections.variations[variation.id]);
    if (!chosen) continue;
    original += chosen.price;
    duration += chosen.duration;
    if (discount && !excluded.has(chosen.id)) discountable += chosen.price;
  }

  for (const option of service.options ?? []) {
    const selOpt = selections.options[option.id];
    if (!selOpt) continue;
    original += option.price;
    duration += option.duration;
    const optIncluded = !!discount && !excluded.has(option.id);
    if (optIncluded) discountable += option.price;
    for (const variation of option.nestedVariations) {
      const chosen = variation.options.find((o) => o.id === selOpt.nestedVariations[variation.id]);
      if (!chosen) continue;
      original += chosen.price;
      duration += chosen.duration;
      // Nested choices follow their parent option unless excluded on their own.
      if (optIncluded && !excluded.has(chosen.id)) discountable += chosen.price;
    }
  }

  if (!discount) {
    return { price: original, original, duration, discountPercent: null, discountAmount: null };
  }
  const reduction = getDiscountReduction(discountable, discount);
  return {
    price: Math.max(0, original - reduction),
    original,
    duration,
    ...describeDiscount(discount),
  };
}

/** Discounted "à partir de" minimum price for the public fiche: the cheapest
 *  reachable core combination, each line reduced unless it's excluded. */
export function getDiscountedMinPrice(
  service: Pick<Service, 'price' | 'variations' | 'discount'>,
  globalDiscount: ServiceDiscount | null | undefined = null,
  now: Date = new Date(),
): {
  price: number;
  original: number;
  discountPercent: number | null;
  discountAmount: number | null;
} {
  const discount = resolveServiceDiscount(service, globalDiscount, now);
  const variations = service.variations ?? [];

  // On additionne d'abord, on remise ensuite — un montant fixe ne peut pas se
  // répartir ligne par ligne. Ça aligne aussi cette fonction sur
  // `computeDiscountedTotal`, qui arrondissait déjà sur le sous-total : la
  // version précédente arrondissait par ligne, d'où un « à partir de »
  // pouvant différer d'un centime du prix réellement affiché ensuite.
  const excluded = new Set(discount?.excludedIds ?? []);
  let original = 0;
  let discountable = 0;

  if (variations.length === 0) {
    original = service.price;
    if (discount) discountable = service.price;
  } else {
    for (const variation of variations) {
      if (variation.options.length === 0) continue;
      const cheapest = variation.options.reduce((a, b) => (b.price < a.price ? b : a));
      original += cheapest.price;
      if (discount && !excluded.has(cheapest.id)) discountable += cheapest.price;
    }
  }

  const reduction = getDiscountReduction(discountable, discount);
  return {
    price: Math.max(0, original - reduction),
    original,
    ...describeDiscount(discount),
  };
}

/** One row of the promo preview: a togglable line with its before/after price.
 *  `id` identifies the variation-option / add-on option (null for the base line,
 *  which is never togglable). `applies` = the discount currently reduces it. */
export interface DiscountPreviewRow {
  id: string | null;
  name: string;
  original: number;
  discounted: number;
  applies: boolean;
}

/** Structured before/after breakdown of a promo on a single service, for the
 *  provider-facing config preview. Each variation/option row is individually
 *  togglable (its `id` flips membership in `excludedIds`). */
export interface ServiceDiscountPreview {
  /** Renseigné pour une promo en pourcentage, 0 sinon. */
  percent: number;
  /** Montant fixe de la promo en centimes, null pour une promo en pourcentage. */
  amount: number | null;
  /** Base price line — only for variation-less services (else null). */
  base: { original: number; discounted: number } | null;
  variations: { name: string; rows: DiscountPreviewRow[] }[];
  options: DiscountPreviewRow[];
  /**
   * Avant/après sur l'ENSEMBLE des lignes éligibles, en supposant tout choisi.
   *
   * C'est la seule lecture qui ait un sens pour une promo en montant fixe :
   * « −10 € » ne se répartit pas sur les lignes, donc l'avant/après par ligne
   * (`DiscountPreviewRow.discounted`) reste égal à l'original dans ce cas, et
   * c'est ce total qui porte l'information.
   */
  total: { original: number; discountable: number; discounted: number };
}

/**
 * Build the before/after preview of a discount applied to a service. Pure +
 * shared so web and mobile render an identical breakdown. Returns null when
 * there's nothing to preview (no/invalid percent).
 */
export function buildServiceDiscountPreview(
  service: Pick<Service, 'price' | 'variations' | 'options'>,
  discount:
    | Pick<ServiceDiscount, 'percent' | 'amount' | 'excludedIds' | 'includeExtras'>
    | null
    | undefined,
): ServiceDiscountPreview | null {
  if (!isDiscountValueUsable(discount)) return null;
  const excluded = resolveExcludedIds(service, discount);
  const isAmount = isAmountDiscount(discount);
  const pct = isAmount ? 0 : (discount!.percent ?? 0);
  // Un montant fixe ne se répartit pas : la colonne « après » de chaque ligne
  // reste égale à l'original, et c'est le total qui porte la remise.
  const cut = (v: number) => (isAmount ? v : Math.max(0, v - Math.round((v * pct) / 100)));
  const hasVariations = (service.variations?.length ?? 0) > 0;

  let original = 0;
  let discountable = 0;
  const count = (id: string | null, price: number) => {
    original += price;
    if (id === null || !excluded.has(id)) discountable += price;
  };

  const row = (id: string, name: string, price: number): DiscountPreviewRow => {
    const applies = !excluded.has(id);
    return { id, name, original: price, discounted: applies ? cut(price) : price, applies };
  };

  if (!hasVariations) count(null, service.price);
  const variations = (service.variations ?? []).map((v) => ({
    name: v.name,
    rows: v.options.map((o) => row(o.id, o.name, o.price)),
  }));
  const options = (service.options ?? []).map((o) => row(o.id, o.name, o.price));

  // Le total suppose TOUT choisi : c'est une borne haute, cohérente avec ce
  // que le pro voit ligne à ligne juste au-dessus.
  for (const v of service.variations ?? []) for (const o of v.options) count(o.id, o.price);
  for (const o of service.options ?? []) count(o.id, o.price);

  return {
    percent: pct,
    amount: isAmount ? discount!.amount! : null,
    base: hasVariations ? null : { original: service.price, discounted: cut(service.price) },
    variations,
    options,
    total: {
      original,
      discountable,
      discounted: Math.max(0, original - getDiscountReduction(discountable, discount)),
    },
  };
}

/** Whole days from `key` (YYYY-MM-DD) to the day given by a UTC instant —
 *  used only for day-granular diffs (no DST drift since both go through UTC). */
function dateKeyToUTC(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Days remaining on an ACTIVE promotion before its window closes.
 *   - returns null when there's no active promo or no end date (open-ended)
 *   - 0  → ends today (last day)
 *   - 1  → ends tomorrow, etc.
 * The window is day-granular (endsAt is inclusive), so this is a day count,
 * not a live clock.
 */
export function getDiscountDaysLeft(
  discount: ServiceDiscount | null | undefined,
  now: Date = new Date(),
): number | null {
  const active = getActiveDiscount(discount, now);
  if (!active?.endsAt) return null;
  const diff = Math.round(
    (dateKeyToUTC(active.endsAt) - dateKeyToUTC(discountDateKey(now))) / 86_400_000,
  );
  return diff < 0 ? null : diff;
}

/**
 * Days-before-end under which the urgency countdown ("Plus que N jours") is
 * surfaced on cards and emphasised in the recap. Above it, surfaces show only
 * the plain validity date. Single knob — bump it to make promos shout earlier.
 */
export const PROMO_URGENCY_DAYS = 15;

/**
 * Highest currently-active promo percentage across a provider — the shop-wide
 * discount and/or any per-service discount. Returns 0 when nothing is active.
 * Lets list surfaces (recent providers, search…) flag "Promotion en cours"
 * to entice returning clients. Evaluated at read time, so date windows stay
 * correct without any denormalised flag.
 */
export function getProviderActivePromoPercent(
  globalDiscount: ServiceDiscount | null | undefined,
  services: Array<Pick<Service, 'discount'>>,
  now: Date = new Date(),
): number {
  let max = 0;
  const g = getActiveDiscount(globalDiscount, now);
  if (g?.percent && g.percent > max) max = g.percent;
  for (const s of services) {
    const d = getActiveDiscount(s.discount, now);
    if (d?.percent && d.percent > max) max = d.percent;
  }
  return max;
}

/**
 * Y a-t-il au moins une promo active, QUELLE QUE SOIT sa forme ?
 *
 * Complément indispensable de `getProviderActivePromoPercent`, qui renvoie 0
 * pour une promo en euros : une pastille « Promotion en cours » branchée sur
 * le seul pourcentage laisserait les promos en montant invisibles.
 */
export function providerHasActivePromo(
  globalDiscount: ServiceDiscount | null | undefined,
  services: Array<Pick<Service, 'discount'>>,
  now: Date = new Date(),
): boolean {
  if (getActiveDiscount(globalDiscount, now)) return true;
  return services.some((s) => getActiveDiscount(s.discount, now) !== null);
}

/**
 * Denormalised promo summary for a provider: the non-expired discount windows
 * (shop-wide + per-service), to store on the provider document. Lets list
 * surfaces (search…) flag promos with ONE read instead of loading every
 * service. Expired windows (endsAt in the past) are dropped; evaluation stays
 * date-correct at read time via getActivePromoPercentFromWindows, so no cron
 * is needed — only a recompute whenever a promo changes.
 */
export function buildPromoWindows(
  globalDiscount: ServiceDiscount | null | undefined,
  services: Array<Pick<Service, 'discount'>>,
  now: Date = new Date(),
): ServiceDiscount[] {
  const today = discountDateKey(now);
  const candidates: Array<ServiceDiscount | null | undefined> = [
    globalDiscount,
    ...services.map((s) => s.discount),
  ];
  const out: ServiceDiscount[] = [];
  for (const d of candidates) {
    if (!isDiscountValueUsable(d)) continue;
    if (d!.endsAt && d!.endsAt < today) continue; // drop expired
    // Firestore refuse `undefined` : on n'écrit que le champ qui porte la
    // valeur, jamais les deux.
    out.push({
      ...(isAmountDiscount(d) ? { amount: d!.amount! } : { percent: d!.percent! }),
      includeExtras: d!.includeExtras ?? true,
      startsAt: d!.startsAt ?? null,
      endsAt: d!.endsAt ?? null,
    });
  }
  return out;
}

/** Highest currently-active percentage from a stored promo-windows summary.
 *  Renvoie 0 quand les promos actives sont toutes en montant fixe — utiliser
 *  `hasActivePromoFromWindows` pour savoir s'il y a une promo tout court. */
export function getActivePromoPercentFromWindows(
  windows: ServiceDiscount[] | null | undefined,
  now: Date = new Date(),
): number {
  let max = 0;
  for (const w of windows ?? []) {
    const d = getActiveDiscount(w, now);
    if (d?.percent && d.percent > max) max = d.percent;
  }
  return max;
}

/** Une promo est-elle active dans le résumé dénormalisé, toutes formes
 *  confondues ? */
export function hasActivePromoFromWindows(
  windows: ServiceDiscount[] | null | undefined,
  now: Date = new Date(),
): boolean {
  return (windows ?? []).some((w) => getActiveDiscount(w, now) !== null);
}

/** Short urgency label from a day count (see getDiscountDaysLeft).
 *  Inline fr/en/it/pt map — a dictionary lookup would drag react/i18n into shared. */
export function formatPromoCountdown(daysLeft: number, locale = 'fr'): string {
  const lang = locale.startsWith('en')
    ? 'en'
    : locale.startsWith('it')
      ? 'it'
      : locale.startsWith('pt')
        ? 'pt'
        : 'fr';
  if (daysLeft <= 0) {
    if (lang === 'en') return 'Last day';
    if (lang === 'it') return 'Ultimo giorno';
    if (lang === 'pt') return 'Último dia';
    return 'Dernier jour';
  }
  if (daysLeft === 1) {
    if (lang === 'en') return 'Ends tomorrow';
    if (lang === 'it') return 'Termina domani';
    if (lang === 'pt') return 'Termina amanhã';
    return 'Se termine demain';
  }
  if (lang === 'en') return `Only ${daysLeft} days left`;
  if (lang === 'it') return `Ancora ${daysLeft} giorni`;
  if (lang === 'pt') return `Faltam ${daysLeft} dias`;
  return `Plus que ${daysLeft} jours`;
}

// Re-export the variation / option shapes by reference so callers
// only need one import. (Pure convenience — they're already typed
// in '../types'.)
export type { ServiceVariation, ServiceOption, ServiceDiscount };
