import type {
  ServiceInfoField,
  ServiceOption,
  ServiceVariation,
  ServiceVariationOption,
} from '@booking-app/shared';

/** Return a new array with the item at `index` moved by `dir` (-1 up,
 *  +1 down). Out-of-bounds moves return the array unchanged. */
export function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= arr.length) return arr;
  const next = [...arr];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Stable client-side id for a freshly created choice. */
export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function newVariationOption(): ServiceVariationOption {
  return { id: genId(), name: '', description: null, price: 0, duration: 0 };
}

export function newVariation(): ServiceVariation {
  return {
    id: genId(),
    name: '',
    description: null,
    options: [newVariationOption(), newVariationOption()],
  };
}

export function newInfoField(): ServiceInfoField {
  return {
    id: genId(),
    name: '',
    description: null,
    type: 'text',
    values: [],
    required: false,
  };
}

/**
 * Drop incomplete choices before persisting: trims names, removes
 * empty-named options/choices, and prunes variations that end up with no
 * name or no usable choice. Keeps Firestore clean and avoids Zod errors
 * on half-filled seeded rows.
 */
export function sanitizeVariations(variations: ServiceVariation[]): ServiceVariation[] {
  return variations
    .map((v) => ({
      ...v,
      name: v.name.trim(),
      options: v.options
        .map((o) => ({ ...o, name: o.name.trim() }))
        .filter((o) => o.name !== ''),
    }))
    .filter((v) => v.name !== '' && v.options.length > 0);
}

export function sanitizeInfoFields(fields: ServiceInfoField[]): ServiceInfoField[] {
  return fields
    .map((f) => ({
      ...f,
      name: f.name.trim(),
      values:
        f.type === 'select'
          ? (f.values ?? []).map((s) => s.trim()).filter(Boolean)
          : f.values,
    }))
    .filter(
      (f) => f.name !== '' && (f.type !== 'select' || (f.values ?? []).length > 0),
    );
}

export function sanitizeOptions(options: ServiceOption[]): ServiceOption[] {
  return options
    .map((o) => ({
      ...o,
      name: o.name.trim(),
      nestedVariations: sanitizeVariations(o.nestedVariations),
      nestedInfoFields: sanitizeInfoFields(o.nestedInfoFields),
    }))
    .filter((o) => o.name !== '');
}

export function newOption(): ServiceOption {
  return {
    id: genId(),
    name: '',
    description: null,
    price: 0,
    duration: 0,
    nestedVariations: [],
    nestedInfoFields: [],
  };
}
