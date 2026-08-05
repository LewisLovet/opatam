import type {
  Service,
  ServiceInfoField,
  ServiceOption,
  ServiceVariation,
} from '@booking-app/shared';
import { isAmountDiscount, resolveExcludedIds } from '@booking-app/shared';
import type { ServiceDiscount, ServiceUnavailableReason } from '@booking-app/shared';

/** Valeurs proposées à l'activation d'une promo : 10 % ou 5 €. */
export const DEFAULT_DISCOUNT_PERCENT = 10;
export const DEFAULT_DISCOUNT_AMOUNT = 500;

/**
 * Forme PERSISTÉE de la promo à partir de l'état du formulaire.
 *
 * N'écrit que le champ correspondant au mode choisi : le schéma refuse un
 * document portant `percent` ET `amount`, et Firestore refuse `undefined`.
 */
export function discountToPayload(
  discount: ServiceFormData['discount'],
): ServiceDiscount | null {
  if (!discount) return null;
  const common = {
    excludedIds: discount.excludedIds,
    startsAt: discount.startsAt,
    endsAt: discount.endsAt,
    notifyLoyaltyClients: discount.notifyLoyaltyClients === true,
  };
  return discount.mode === 'amount'
    ? { amount: Math.round(discount.amount), ...common }
    : { percent: Math.round(discount.percent), ...common };
}

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
    /** Quelle forme de remise est active. Les DEUX valeurs sont conservées
     *  dans le formulaire : basculer de % à € et revenir ne doit pas effacer
     *  ce que le pro avait saisi. Une seule est persistée (voir
     *  `discountToPayload`). */
    mode: 'percent' | 'amount';
    percent: number;
    /** Montant fixe en centimes. */
    amount: number;
    /** Variation-option / option ids excluded from the promo (per-line). */
    excludedIds: string[];
    startsAt: string | null; // YYYY-MM-DD
    endsAt: string | null;   // YYYY-MM-DD
    /** Prévenir les clients fidélité par email — choix explicite du pro. */
    notifyLoyaltyClients?: boolean;
  } | null;
  /** Réservable en ligne. `false` = visible mais marquée indisponible. */
  isAvailable: boolean;
  /** Motif d'indisponibilité (code traduit côté client). */
  unavailableReason: ServiceUnavailableReason | null;
  /** Texte libre, utilisé uniquement quand le motif est « autre ». */
  unavailableNote: string | null;
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
          mode: isAmountDiscount(service.discount) ? 'amount' : 'percent',
          // Valeurs de repli quand l'autre forme n'a jamais été saisie.
          percent: service.discount.percent ?? DEFAULT_DISCOUNT_PERCENT,
          amount: service.discount.amount ?? DEFAULT_DISCOUNT_AMOUNT,
          // Migrate legacy includeExtras into the per-line excludedIds model.
          excludedIds: Array.from(resolveExcludedIds(service, service.discount)),
          startsAt: service.discount.startsAt ?? null,
          endsAt: service.discount.endsAt ?? null,
          notifyLoyaltyClients: service.discount.notifyLoyaltyClients === true,
        }
      : null,
    isAvailable: service.isAvailable !== false,
    // Documents antérieurs aux motifs : une note sans code vaut « autre ».
    unavailableReason:
      service.unavailableReason ?? (service.unavailableNote ? 'other' : null),
    unavailableNote: service.unavailableNote ?? null,
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
    isAvailable: true,
    unavailableReason: null,
    unavailableNote: null,
    variations: [],
    options: [],
    infoFields: [],
  };
}
