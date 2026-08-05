import { z } from 'zod';
import { SERVICE_UNAVAILABLE_REASONS } from '../constants';

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
 * Per-service promotion — pourcentage OU montant fixe en centimes, jamais les
 * deux. `includeExtras` decides whether variations/options are discounted too.
 * Optional inclusive date window as local YYYY-MM-DD strings. `null` = no promo
 * on this service.
 *
 * Le refus des deux champs simultanés n'est pas cosmétique : sans lui, le
 * comportement dépendrait de l'ordre des tests dans `getDiscountReduction`,
 * donc d'un détail d'implémentation.
 */
export const serviceDiscountSchema = z
  .object({
    percent: z
      .number()
      .int({ message: 'Le pourcentage doit être un nombre entier' })
      .min(1, { message: 'La réduction doit être d\'au moins 1 %' })
      .max(100, { message: 'La réduction ne peut pas dépasser 100 %' })
      .optional(),
    /** Montant fixe en centimes. */
    amount: z
      .number()
      .int({ message: 'Le montant doit être un nombre entier de centimes' })
      .min(1, { message: 'La réduction doit être d\'au moins 1 centime' })
      .max(1_000_000, { message: 'La réduction ne peut pas dépasser 10 000 €' })
      .optional(),
    /** Variation-option / option ids excluded from the promo (per-line control). */
    excludedIds: z.array(z.string()).optional(),
    /** @deprecated Legacy single toggle, kept for back-compat reads. */
    includeExtras: z.boolean().optional(),
    /** Prévenir les clients fidélité par email (choix explicite du pro). */
    notifyLoyaltyClients: z.boolean().optional(),
    startsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date de début invalide' })
      .nullable()
      .optional(),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date de fin invalide' })
      .nullable()
      .optional(),
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt <= d.endsAt, {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['endsAt'],
  })
  .refine((d) => (d.percent != null) !== (d.amount != null), {
    message: 'Choisissez une réduction en pourcentage OU en euros',
    path: ['percent'],
  })
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
  // define the whole prestation. Same 24h ceiling as the base duration:
  // an 8h base cap used to TRUNCATE the derived minimum of a longer
  // prestation, and pre-choice availability then offered slots too short.
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
    // 24h, comme les durées de variations : avec variations, cette durée
    // de base est DÉRIVÉE de la combinaison la plus courte et un plafond
    // plus bas la tronquait silencieusement.
    .max(1440, { message: 'La durée maximum est de 24 heures (1440 minutes)' }),
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

  // Per-service promotion (pourcentage ou montant). Voir serviceDiscountSchema.
  discount: serviceDiscountSchema.optional(),

  // Disponibilité à la réservation en ligne. Absent = disponible : les
  // prestations existantes n'ont pas à être migrées, et une valeur manquante
  // ne doit jamais bloquer une réservation.
  isAvailable: z.boolean().optional(),
  unavailableReason: z
    .enum(SERVICE_UNAVAILABLE_REASONS, {
      errorMap: () => ({ message: "Motif d'indisponibilité invalide" }),
    })
    .nullable()
    .optional(),
  unavailableNote: z
    .string()
    .trim()
    .max(120, { message: 'La note ne peut pas dépasser 120 caractères' })
    .nullable()
    .optional(),

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
    .max(1440)
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
  // Per-service promotion (percentage). See serviceDiscountSchema above.
  discount: serviceDiscountSchema.optional(),
  isActive: z.boolean().optional(),
  // Disponibilité à la réservation en ligne. Absent = disponible : les
  // prestations existantes n'ont pas à être migrées, et une valeur manquante
  // ne doit jamais bloquer une réservation.
  isAvailable: z.boolean().optional(),
  unavailableReason: z
    .enum(SERVICE_UNAVAILABLE_REASONS, {
      errorMap: () => ({ message: "Motif d'indisponibilité invalide" }),
    })
    .nullable()
    .optional(),
  unavailableNote: z
    .string()
    .trim()
    .max(120, { message: 'La note ne peut pas dépasser 120 caractères' })
    .nullable()
    .optional(),

  sortOrder: z.number().int().min(0).optional(),

  // Client-facing choices — see createServiceSchema for the field docs.
  variations: z.array(serviceVariationSchema).optional(),
  options: z.array(serviceOptionSchema).optional(),
  infoFields: z.array(serviceInfoFieldSchema).optional(),
});

// Export types
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
