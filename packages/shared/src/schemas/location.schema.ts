import { z } from 'zod';

// French postal code regex: 5 digits
const frenchPostalCodeRegex = /^\d{5}$/;

// French phone regex: starts with 0, then 6 or 7, then 8 digits (mobile) or 01-05, 09 (landline)
const frenchPhoneRegex = /^0[1-79]\d{8}$/;

// Geopoint schema
export const geopointSchema = z.object({
  latitude: z
    .number()
    .min(-90, { message: 'La latitude doit être entre -90 et 90' })
    .max(90, { message: 'La latitude doit être entre -90 et 90' }),
  longitude: z
    .number()
    .min(-180, { message: 'La longitude doit être entre -180 et 180' })
    .max(180, { message: 'La longitude doit être entre -180 et 180' }),
});

// Create location schema
export const createLocationSchema = z.object({
  name: z
    .string({ required_error: 'Le nom du lieu est requis' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' }),
  address: z
    .string({ required_error: 'L\'adresse est requise' })
    .min(5, { message: 'L\'adresse doit contenir au moins 5 caractères' })
    .max(200, { message: 'L\'adresse ne peut pas dépasser 200 caractères' }),
  city: z
    .string({ required_error: 'La ville est requise' })
    .min(2, { message: 'La ville doit contenir au moins 2 caractères' })
    .max(100, { message: 'La ville ne peut pas dépasser 100 caractères' }),
  postalCode: z
    .string({ required_error: 'Le code postal est requis' })
    .regex(frenchPostalCodeRegex, { message: 'Code postal invalide (5 chiffres requis)' }),
  country: z
    .string()
    .default('France'),
  geopoint: geopointSchema.nullable().optional(),
  description: z
    .string()
    .max(500, { message: 'La description ne peut pas dépasser 500 caractères' })
    .nullable()
    .optional(),
  phone: z
    .string()
    .regex(frenchPhoneRegex, { message: 'Numéro de téléphone invalide' })
    .nullable()
    .optional(),
  email: z
    .string()
    .email({ message: 'Format d\'email invalide' })
    .nullable()
    .optional(),
  photoURLs: z
    .array(z.string().url({ message: 'URL de la photo invalide' }))
    .max(10, { message: 'Maximum 10 photos autorisées' })
    .optional()
    .default([]),
});

// Update location schema
export const updateLocationSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
    .optional(),
  address: z
    .string()
    .min(5, { message: 'L\'adresse doit contenir au moins 5 caractères' })
    .max(200, { message: 'L\'adresse ne peut pas dépasser 200 caractères' })
    .optional(),
  city: z
    .string()
    .min(2, { message: 'La ville doit contenir au moins 2 caractères' })
    .max(100, { message: 'La ville ne peut pas dépasser 100 caractères' })
    .optional(),
  postalCode: z
    .string()
    .regex(frenchPostalCodeRegex, { message: 'Code postal invalide (5 chiffres requis)' })
    .optional(),
  country: z.string().optional(),
  geopoint: geopointSchema.nullable().optional(),
  description: z
    .string()
    .max(500, { message: 'La description ne peut pas dépasser 500 caractères' })
    .nullable()
    .optional(),
  phone: z
    .string()
    .regex(frenchPhoneRegex, { message: 'Numéro de téléphone invalide' })
    .nullable()
    .optional(),
  email: z
    .string()
    .email({ message: 'Format d\'email invalide' })
    .nullable()
    .optional(),
  photoURLs: z
    .array(z.string().url({ message: 'URL de la photo invalide' }))
    .max(10, { message: 'Maximum 10 photos autorisées' })
    .optional(),
  isActive: z.boolean().optional(),
});

// Export types
export type GeopointInput = z.infer<typeof geopointSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
