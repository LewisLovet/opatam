import { z } from 'zod';

// French phone regex: starts with 0, then 6 or 7, then 8 digits
const frenchPhoneRegex = /^0[67]\d{8}$/;

// Create member schema - MINIMUM requis
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
    .regex(frenchPhoneRegex, { message: 'Numéro de téléphone invalide (format: 06/07 + 8 chiffres)' })
    .nullable()
    .optional(),
  role: z
    .string()
    .max(50, { message: 'Le rôle ne peut pas dépasser 50 caractères' })
    .optional(),
  locationIds: z
    .array(z.string())
    .optional()
    .default([]),
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
    .regex(frenchPhoneRegex, { message: 'Numéro de téléphone invalide (format: 06/07 + 8 chiffres)' })
    .nullable()
    .optional(),
  role: z
    .string()
    .max(50, { message: 'Le rôle ne peut pas dépasser 50 caractères' })
    .optional(),
  locationIds: z
    .array(z.string())
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
  accessCode: z.string().optional(),
});

// Export types
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
