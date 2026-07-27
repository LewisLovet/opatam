import { z } from 'zod';
import { isValidInternationalPhone } from '../utils/phone';

// Create member schema - MINIMUM requis
// 1 membre = 1 lieu (pas de tableau locationIds)
export const createMemberSchema = z.object({
  name: z
    .string({ required_error: 'Le nom est requis' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' }),
  email: z
    .string({ required_error: 'L\'email est requis' })
    .email({ message: 'Format d\'email invalide' }),
  phone: z
    .string()
    .refine((v) => !v || isValidInternationalPhone(v), { message: 'Numéro de téléphone invalide' })
    .nullable()
    .optional(),
  role: z
    .string()
    .max(50, { message: 'Le rôle ne peut pas dépasser 50 caractères' })
    .optional(),
  locationId: z
    .string({ required_error: 'Le lieu est requis' }),
  serviceIds: z
    .array(z.string())
    .optional()
    .default([]),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Format de couleur invalide (ex: #FF5733)' })
    .optional(),
  photoURL: z
    .string()
    .url({ message: 'URL de la photo invalide' })
    .nullable()
    .optional(),
  isDefault: z
    .boolean()
    .optional()
    .default(false),
});

// Update member schema - Tout optionnel
export const updateMemberSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
    .optional(),
  email: z
    .string()
    .email({ message: 'Format d\'email invalide' })
    .optional(),
  phone: z
    .string()
    .refine((v) => !v || isValidInternationalPhone(v), { message: 'Numéro de téléphone invalide' })
    .nullable()
    .optional(),
  role: z
    .string()
    .max(50, { message: 'Le rôle ne peut pas dépasser 50 caractères' })
    .optional(),
  locationId: z
    .string()
    .optional(),
  serviceIds: z
    .array(z.string())
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Format de couleur invalide (ex: #FF5733)' })
    .optional(),
  photoURL: z
    .string()
    .url({ message: 'URL de la photo invalide' })
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  accessCode: z.string().optional(),
});

// Export types
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
