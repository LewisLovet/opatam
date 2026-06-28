import { z } from 'zod';
import { serviceDiscountSchema } from './service.schema';

// Social links schema
export const socialLinksSchema = z.object({
  instagram: z.string().url({ message: 'URL Instagram invalide' }).nullable().optional(),
  facebook: z.string().url({ message: 'URL Facebook invalide' }).nullable().optional(),
  tiktok: z.string().url({ message: 'URL TikTok invalide' }).nullable().optional(),
  website: z.string().url({ message: 'URL du site web invalide' }).nullable().optional(),
  paypal: z.string().url({ message: 'URL PayPal invalide' }).nullable().optional(),
});

// Provider settings schema
export const providerSettingsSchema = z.object({
  reminderTimes: z.array(z.number().int().positive()),
  requiresConfirmation: z.boolean(),
  defaultBufferTime: z.number().int().min(0).max(120),
  timezone: z.string(),
  // Reservation policy settings
  minBookingNotice: z
    .number()
    .int()
    .min(0, { message: 'Le délai minimum doit être positif' })
    .max(168, { message: 'Le délai minimum ne peut pas dépasser 168 heures (7 jours)' })
    .default(2),
  maxBookingAdvance: z
    .number()
    .int()
    .min(1, { message: 'Le délai maximum doit être d\'au moins 1 jour' })
    .max(365, { message: 'Le délai maximum ne peut pas dépasser 365 jours' })
    .default(60),
  allowClientCancellation: z.boolean().default(true),
  cancellationDeadline: z
    .number()
    .int()
    .min(0, { message: 'Le délai d\'annulation doit être positif' })
    .max(168, { message: 'Le délai d\'annulation ne peut pas dépasser 168 heures (7 jours)' })
    .default(24),
  slotInterval: z
    .number()
    .int()
    .min(5, { message: 'L\'intervalle minimum est de 5 minutes' })
    .max(60, { message: 'L\'intervalle maximum est de 60 minutes' })
    .default(15)
    .optional(),
  bookingNotice: z
    .string()
    .max(1000, { message: 'Le texte ne peut pas dépasser 1000 caractères' })
    .nullable()
    .optional(),
  autoReviewReminder: z.boolean().optional(),

  // Default deposit (acomptes add-on). Always a percentage so it scales
  // with each service price and can never exceed it.
  depositDefault: z
    .object({
      percent: z
        .number()
        .int({ message: "Le pourcentage doit être un entier" })
        .min(1, { message: "L'acompte doit être d'au moins 1 %" })
        .max(100, { message: "L'acompte ne peut pas dépasser 100 %" }),
      refundDeadlineHours: z
        .number()
        .int()
        .min(0, { message: 'Le délai de remboursement doit être positif' })
        .max(720, { message: 'Le délai ne peut pas dépasser 720 heures (30 jours)' })
        .default(24),
    })
    .nullable()
    .optional(),

  // Shop-wide promotion (percentage), applied to services without their own
  // discount. Reuses the per-service discount shape.
  globalDiscount: serviceDiscountSchema.optional(),
});

// Create provider schema - MINIMUM requis pour creer un provider
// Le plan est mis automatiquement a 'trial' par le service
export const createProviderSchema = z.object({
  businessName: z
    .string({ required_error: 'Le nom de l\'entreprise est requis' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' }),
  category: z
    .string()
    .max(50, { message: 'La catégorie ne peut pas dépasser 50 caractères' })
    .optional(),
  description: z
    .string()
    .max(1000, { message: 'La description ne peut pas dépasser 1000 caractères' })
    .optional()
    .default(''),
});

// Update provider schema - Tout optionnel
export const updateProviderSchema = z.object({
  businessName: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
    .optional(),
  description: z
    .string()
    .max(1000, { message: 'La description ne peut pas dépasser 1000 caractères' })
    .optional(),
  category: z
    .string()
    .max(50, { message: 'La catégorie ne peut pas dépasser 50 caractères' })
    .optional(),
  photoURL: z.string().url({ message: 'URL de la photo invalide' }).nullable().optional(),
  coverPhotoURL: z.string().url({ message: 'URL de la photo de couverture invalide' }).nullable().optional(),
  portfolioPhotos: z.array(z.string().url()).optional(),
  socialLinks: socialLinksSchema.optional(),
  settings: providerSettingsSchema.partial().optional(),
  // Referral link captured at signup. Without these here, the schema stripped
  // them and the code was never persisted → the affiliate coupon never applied
  // at checkout. Kept nullable so it can be cleared.
  affiliateCode: z.string().max(50).nullable().optional(),
  affiliateId: z.string().nullable().optional(),
});

// Export types
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;
export type ProviderSettingsInput = z.infer<typeof providerSettingsSchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
