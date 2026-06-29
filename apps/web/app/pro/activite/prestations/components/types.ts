import type {
  Service,
  ServiceInfoField,
  ServiceOption,
  ServiceVariation,
} from '@booking-app/shared';
import { resolveExcludedIds } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

/**
 * The full editable shape of a prestation, shared by every section of
 * the page editor. Mirrors the persisted `Service` but keeps the
 * deposit in a strict discriminated union and always materialises the
 * optional choice arrays so sections never null-check.
 *
 * This is the canonical form type — the legacy modal had its own copy
 * which is retired once the page editor ships.
 */
export interface ServiceFormData {
  name: string;
  description: string | null;
  photoURL: string | null;
  duration: number;
  price: number; // cents
  priceMax: number | null; // cents (null = prix fixe)
  bufferTime: number;
  categoryId: string | null;
  locationIds: string[];
  memberIds: string[] | null;
  /** Hex color (#RRGGBB) overriding the member color on the calendar.
   *  null = fall back to the member color. */
  color: string | null;
  /** Per-service deposit. null = inherit provider default; { type:'none' }
   *  = explicitly disabled; fixed/percent = custom override. */
  deposit:
    | { type: 'fixed' | 'percent'; value: number; refundDeadlineHours: number }
    | { type: 'none' }
    | null;
  /** Per-service promotion (percentage). null = no promo on this prestation. */
  discount: {
    percent: number;
    /** Variation-option / option ids excluded from the promo (per-line). */
    excludedIds: string[];
    startsAt: string | null; // YYYY-MM-DD
    endsAt: string | null;   // YYYY-MM-DD
  } | null;
  /** Client-facing choices. Empty arrays for a plain prestation. */
  variations: ServiceVariation[];
  options: ServiceOption[];
  infoFields: ServiceInfoField[];
}

/** Coerce the looser Service.deposit shape (Firestore-friendly) into the
 *  strict discriminated union used by the form. */
export function normalizeDepositForForm(
  raw: Service['deposit'] | undefined | null,
): ServiceFormData['deposit'] {
  if (!raw) return null;
  if (raw.type === 'none') return { type: 'none' };
  return {
    type: raw.type,
    value: raw.value ?? 0,
    refundDeadlineHours: raw.refundDeadlineHours ?? 24,
  };
}

/** Build the form state for an existing prestation. */
export function serviceToFormData(service: WithId<Service>): ServiceFormData {
  return {
    name: service.name,
    description: service.description,
    photoURL: service.photoURL ?? null,
    duration: service.duration,
    price: service.price,
    priceMax: service.priceMax ?? null,
    bufferTime: service.bufferTime,
    categoryId: service.categoryId ?? null,
    locationIds: service.locationIds,
    memberIds: service.memberIds,
    color: service.color ?? null,
    deposit: normalizeDepositForForm(service.deposit),
    discount: service.discount
      ? {
          percent: service.discount.percent,
          // Migrate legacy includeExtras into the per-line excludedIds model.
          excludedIds: Array.from(resolveExcludedIds(service, service.discount)),
          startsAt: service.discount.startsAt ?? null,
          endsAt: service.discount.endsAt ?? null,
        }
      : null,
    variations: service.variations ?? [],
    options: service.options ?? [],
    infoFields: service.infoFields ?? [],
  };
}

/** Blank form state for a new prestation, pre-selecting the first
 *  location when there is exactly one obvious default. */
export function emptyServiceFormData(
  locationIds: string[] = [],
): ServiceFormData {
  return {
    name: '',
    description: null,
    photoURL: null,
    duration: 60,
    price: 0,
    priceMax: null,
    bufferTime: 0,
    categoryId: null,
    locationIds,
    memberIds: null,
    color: null,
    deposit: null,
    discount: null,
    variations: [],
    options: [],
    infoFields: [],
  };
}
