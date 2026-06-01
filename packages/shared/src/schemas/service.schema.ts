import { z } from 'zod';

/**
 * Per-service deposit override.
 *
 *   type: 'fixed'   → value is in cents, must be ≤ this service's price
 *                     (refined further in createServiceSchema below)
 *   type: 'percent' → value is 1-100 (no extra constraint, % is always
 *                     proportional)
 *
 * `null` means: no override — fall back to the provider's `depositDefault`
 * (or no deposit if the provider hasn't configured one either).
 */
export const serviceDepositSchema = z
  .union([
    // Custom deposit (fixed amount or percentage)
    z.object({
      type: z.enum(['fixed', 'percent'], {
        errorMap: () => ({ message: 'Type d\'acompte invalide (fixed, percent ou none)' }),
      }),
      value: z
        .number({ required_error: 'Le montant de l\'acompte est requis' })
        .int({ message: "Le montant doit être un nombre entier" })
        .min(1, { message: 'Le montant doit être positif' }),
      refundDeadlineHours: z
        .number()
        .int()
        .min(0, { message: 'Le délai de remboursement doit être positif' })
        .max(720, { message: 'Le délai ne peut pas dépasser 720 heures (30 jours)' })
        .default(24),
    }),
    // Explicitly disabled — overrides the provider default with "no deposit".
    z.object({
      type: z.literal('none'),
    }),
  ])
  .nullable();

/**
 * Client-facing choices (variations / options / info fields) attached to
 * a service. All absolute pricing (cents) and duration (minutes). These
 * mirror the `Service*` interfaces in ../types and are validated the same
 * way on create and update. Every field is OPTIONAL on the service
 * schemas below so legacy prestations (no choices) keep validating.
 */
const choiceNameSchema = z
  .string({ required_error: 'Le nom est requis' })
  .min(1, { message: 'Le nom est requis' })
  .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' });

/**
 * Info-field "name" is really a QUESTION shown to the client (e.g.
 * "Avez-vous une information importante concernant vos cheveux ?"),
 * not a short label like a variation/option name — so it gets a far
 * more generous limit than `choiceNameSchema`'s 100 chars.
 */
const infoFieldNameSchema = z
  .string({ required_error: 'La question est requise' })
  .min(1, { message: 'La question est requise' })
  .max(300, { message: 'La question ne peut pas dépasser 300 caractères' });

const choiceDescriptionSchema = z
  .string()
  .max(300, { message: 'La description ne peut pas dépasser 300 caractères' })
  .nullable()
  .optional();

const choicePriceSchema = z
  .number()
  .int({ message: 'Le prix doit être en centimes (nombre entier)' })
  .min(0, { message: 'Le prix ne peut pas être négatif' })
  .max(1000000, { message: 'Le prix ne peut pas dépasser 10 000€' });

const choiceDurationSchema = z
  .number()
  .int({ message: 'La durée doit être un nombre entier' })
  .min(0, { message: 'La durée ne peut pas être négative' })
  // Variation / option durations can be long (braids, dreadlocks…) and
  // define the whole prestation, so allow up to 24h here (vs 8h on the
  // base service duration).
  .max(1440, { message: 'La durée maximum est de 24 heures (1440 minutes)' });

/** One selectable row inside a variation (e.g. "Mi-dos · 70€ · +30min"). */
export const serviceVariationOptionSchema = z.object({
  id: z.string(),
  name: choiceNameSchema,
  description: choiceDescriptionSchema,
  price: choicePriceSchema,
  duration: choiceDurationSchema,
});

/** A required, mutually-exclusive group of choices (radio), e.g. "Longueur". */
export const serviceVariationSchema = z.object({
  id: z.string(),
  name: choiceNameSchema,
  description: choiceDescriptionSchema,
  options: z.array(serviceVariationOptionSchema),
});

/** A purely informative question (no price impact). */
export const serviceInfoFieldSchema = z.object({
  id: z.string(),
  name: infoFieldNameSchema,
  description: choiceDescriptionSchema,
  type: z.enum(['select', 'text', 'boolean']),
  values: z.array(z.string()).optional(),
  required: z.boolean(),
});

/** A top-level add-on (checkbox). Can expose its own nested variations
 *  and info fields, only relevant when the option is checked. */
export const serviceOptionSchema = z.object({
  id: z.string(),
  name: choiceNameSchema,
  description: choiceDescriptionSchema,
  price: choicePriceSchema,
  duration: choiceDurationSchema,
  nestedVariations: z.array(serviceVariationSchema),
  nestedInfoFields: z.array(serviceInfoFieldSchema),
});

// Create service schema - MINIMUM requis (name, duration, price)
export const createServiceSchema = z.object({
  name: z
    .string({ required_error: 'Le nom du service est requis' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' }),
  description: z
    .string()
    .max(2000, { message: 'La description ne peut pas dépasser 2000 caractères' })
    .nullable()
    .optional(),
  duration: z
    .number({ required_error: 'La durée est requise' })
    .int({ message: 'La durée doit être un nombre entier' })
    .min(5, { message: 'La durée minimum est de 5 minutes' })
    .max(480, { message: 'La durée maximum est de 8 heures (480 minutes)' }),
  price: z
    .number({ required_error: 'Le prix est requis' })
    .int({ message: 'Le prix doit être en centimes (nombre entier)' })
    .min(0, { message: 'Le prix ne peut pas être négatif' })
    .max(1000000, { message: 'Le prix ne peut pas dépasser 10 000€' }),
  priceMax: z
    .number()
    .int({ message: 'Le prix max doit être en centimes (nombre entier)' })
    .min(0, { message: 'Le prix max ne peut pas être négatif' })
    .max(1000000, { message: 'Le prix max ne peut pas dépasser 10 000€' })
    .nullable()
    .optional(),
  bufferTime: z
    .number()
    .int()
    .min(0)
    .max(120)
    .optional()
    .default(0),
  categoryId: z
    .string()
    .nullable()
    .optional(),
  locationIds: z
    .array(z.string())
    .optional()
    .default([]),
  memberIds: z
    .array(z.string())
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Format de couleur invalide (ex: #FF5733)' })
    .nullable()
    .optional(),
  photoURL: z
    .string()
    .url({ message: 'URL de la photo invalide' })
    .nullable()
    .optional(),
  isOnline: z.boolean().optional().default(false),

  // Per-service deposit override. See serviceDepositSchema above.
  deposit: serviceDepositSchema.optional(),

  // Client-facing choices — all optional, default empty so a service
  // without them validates exactly as before.
  variations: z.array(serviceVariationSchema).optional(),
  options: z.array(serviceOptionSchema).optional(),
  infoFields: z.array(serviceInfoFieldSchema).optional(),
})
  .refine(
    (data) => !data.priceMax || data.priceMax > data.price,
    { message: 'Le prix max doit être supérieur au prix min', path: ['priceMax'] }
  )
  .refine(
    (data) => {
      if (!data.deposit || data.deposit.type !== 'fixed') return true;
      return data.deposit.value <= data.price;
    },
    {
      message: "L'acompte fixe ne peut pas dépasser le prix de la prestation",
      path: ['deposit', 'value'],
    }
  )
  .refine(
    (data) => {
      if (!data.deposit || data.deposit.type !== 'percent') return true;
      return data.deposit.value <= 100;
    },
    {
      message: 'Un acompte en pourcentage ne peut pas dépasser 100 %',
      path: ['deposit', 'value'],
    }
  );

// Update service schema - Tout optionnel
export const updateServiceSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
    .optional(),
  description: z
    .string()
    .max(2000, { message: 'La description ne peut pas dépasser 2000 caractères' })
    .nullable()
    .optional(),
  duration: z
    .number()
    .int()
    .min(5)
    .max(480)
    .optional(),
  price: z
    .number()
    .int()
    .min(0)
    .max(1000000)
    .optional(),
  priceMax: z
    .number()
    .int()
    .min(0)
    .max(1000000)
    .nullable()
    .optional(),
  bufferTime: z
    .number()
    .int()
    .min(0)
    .max(120)
    .optional(),
  categoryId: z
    .string()
    .nullable()
    .optional(),
  locationIds: z
    .array(z.string())
    .optional(),
  memberIds: z
    .array(z.string())
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Format de couleur invalide (ex: #FF5733)' })
    .nullable()
    .optional(),
  photoURL: z
    .string()
    .url({ message: 'URL de la photo invalide' })
    .nullable()
    .optional(),
  isOnline: z.boolean().optional(),
  // Per-service deposit override. The cross-field constraint (fixed value
  // ≤ price) lives on createServiceSchema; updates should validate against
  // the merged record server-side if both `price` and `deposit.value`
  // change in the same payload.
  deposit: serviceDepositSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),

  // Client-facing choices — see createServiceSchema for the field docs.
  variations: z.array(serviceVariationSchema).optional(),
  options: z.array(serviceOptionSchema).optional(),
  infoFields: z.array(serviceInfoFieldSchema).optional(),
});

// Export types
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
