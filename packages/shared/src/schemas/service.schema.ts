import { z } from 'zod';

// Create service schema - MINIMUM requis (name, duration, price)
export const createServiceSchema = z.object({
  name: z
    .string({ required_error: 'Le nom du service est requis' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' }),
  description: z
    .string()
    .max(500, { message: 'La description ne peut pas dépasser 500 caractères' })
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
  bufferTime: z
    .number()
    .int()
    .min(0)
    .max(120)
    .optional()
    .default(0),
  category: z
    .string()
    .max(50)
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
    .optional(),
  photoURL: z
    .string()
    .url({ message: 'URL de la photo invalide' })
    .nullable()
    .optional(),
  isOnline: z.boolean().optional().default(false),
  requiresDeposit: z.boolean().optional().default(false),
  depositAmount: z
    .number()
    .int()
    .min(0)
    .optional(),
});

// Update service schema - Tout optionnel
export const updateServiceSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
    .optional(),
  description: z
    .string()
    .max(500, { message: 'La description ne peut pas dépasser 500 caractères' })
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
  bufferTime: z
    .number()
    .int()
    .min(0)
    .max(120)
    .optional(),
  category: z
    .string()
    .max(50)
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
    .optional(),
  photoURL: z
    .string()
    .url({ message: 'URL de la photo invalide' })
    .nullable()
    .optional(),
  isOnline: z.boolean().optional(),
  requiresDeposit: z.boolean().optional(),
  depositAmount: z
    .number()
    .int()
    .min(0)
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// Export types
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
