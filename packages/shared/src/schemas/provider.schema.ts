import { z } from 'zod';

// Social links schema
export const socialLinksSchema = z.object({
  instagram: z.string().url({ message: 'URL Instagram invalide' }).nullable().optional(),
  facebook: z.string().url({ message: 'URL Facebook invalide' }).nullable().optional(),
  tiktok: z.string().url({ message: 'URL TikTok invalide' }).nullable().optional(),
  website: z.string().url({ message: 'URL du site web invalide' }).nullable().optional(),
});

// Provider settings schema
export const providerSettingsSchema = z.object({
  reminderTimes: z.array(z.number().int().positive()),
  requiresConfirmation: z.boolean(),
  defaultBufferTime: z.number().int().min(0).max(120),
  timezone: z.string(),
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
});

// Export types
export type SocialLinksInput = z.infer<typeof socialLinksSchema>;
export type ProviderSettingsInput = z.infer<typeof providerSettingsSchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
