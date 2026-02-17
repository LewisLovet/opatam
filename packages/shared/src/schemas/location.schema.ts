import { z } from 'zod';

// French postal code regex: 5 digits
const frenchPostalCodeRegex = /^\d{5}$/;

// French phone regex: starts with 0, then 6 or 7, then 8 digits (mobile) or 01-05, 09 (landline)
const frenchPhoneRegex = /^0[1-79]\d{8}$/;

// Location type enum
export const locationTypeSchema = z.enum(['fixed', 'mobile']);

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
    .string()
    .max(200, { message: 'L\'adresse ne peut pas dépasser 200 caractères' })
    .optional()
    .default(''),
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
  type: locationTypeSchema.default('fixed'),
  travelRadius: z
    .number()
    .min(1, { message: 'Le rayon doit être d\'au moins 1 km' })
    .max(100, { message: 'Le rayon ne peut pas dépasser 100 km' })
    .nullable()
    .optional()
    .default(null),
}).refine(
  (data) => {
    // If type is mobile, travelRadius must be set
    if (data.type === 'mobile' && (data.travelRadius === null || data.travelRadius === undefined)) {
      return false;
    }
    return true;
  },
  {
    message: 'Le rayon de déplacement est requis pour un lieu de type déplacement',
    path: ['travelRadius'],
  }
);

// Update location schema
export const updateLocationSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
    .optional(),
  address: z
    .string()
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
  type: locationTypeSchema.optional(),
  travelRadius: z
    .number()
    .min(1, { message: 'Le rayon doit être d\'au moins 1 km' })
    .max(100, { message: 'Le rayon ne peut pas dépasser 100 km' })
    .nullable()
    .optional(),
});

// Export types
export type GeopointInput = z.infer<typeof geopointSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
