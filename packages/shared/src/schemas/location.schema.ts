import { z } from 'zod';

// Postal code validation by country (ISO 3166-1 alpha-2)
export const POSTAL_CODE_PATTERNS: Record<string, { regex: RegExp; example: string }> = {
  FR: { regex: /^\d{5}$/, example: '75001' },
  BE: { regex: /^[1-9]\d{3}$/, example: '1000' },
  LU: { regex: /^(?:L-)?\d{4}$/, example: '1536' },
  CH: { regex: /^[1-9]\d{3}$/, example: '8001' },
  DE: { regex: /^\d{5}$/, example: '10117' },
  ES: { regex: /^\d{5}$/, example: '28013' },
  IT: { regex: /^\d{5}$/, example: '00184' },
  NL: { regex: /^\d{4}\s?[A-Z]{2}$/, example: '1015 AA' },
  PT: { regex: /^\d{4}-\d{3}$/, example: '1100-053' },
};

// Phone validation by country
export const PHONE_PATTERNS: Record<string, { regex: RegExp; example: string }> = {
  FR: { regex: /^(?:\+33|0)[1-79]\d{8}$/, example: '06 12 34 56 78' },
  BE: { regex: /^(?:\+32|0)\d{8,9}$/, example: '0412 34 56 78' },
  LU: { regex: /^(?:\+352|0)\d{6,9}$/, example: '+352 621 123 456' },
  CH: { regex: /^(?:\+41|0)\d{9}$/, example: '079 123 45 67' },
  DE: { regex: /^(?:\+49|0)\d{10,11}$/, example: '0151 12345678' },
  ES: { regex: /^(?:\+34|0)?\d{9}$/, example: '612 345 678' },
  IT: { regex: /^(?:\+39|0)?\d{9,10}$/, example: '312 345 6789' },
  NL: { regex: /^(?:\+31|0)\d{9}$/, example: '06 12345678' },
  PT: { regex: /^(?:\+351|0)?\d{9}$/, example: '912 345 678' },
};

/** Validate a postal code for a given country. Falls back to French validation. */
export function isValidPostalCode(postalCode: string, countryCode: string = 'FR'): boolean {
  const pattern = POSTAL_CODE_PATTERNS[countryCode.toUpperCase()] ?? POSTAL_CODE_PATTERNS.FR;
  return pattern.regex.test(postalCode);
}

/** Validate a phone number for a given country. Falls back to French validation. */
export function isValidPhone(phone: string, countryCode: string = 'FR'): boolean {
  const cleaned = phone.replace(/[\s.-]/g, '');
  const pattern = PHONE_PATTERNS[countryCode.toUpperCase()] ?? PHONE_PATTERNS.FR;
  return pattern.regex.test(cleaned);
}

// Supported country codes
export const SUPPORTED_COUNTRY_CODES = ['FR', 'BE', 'LU', 'CH', 'DE', 'ES', 'IT', 'NL', 'PT'] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

// Legacy regexes kept for backward compatibility in schemas
const frenchPostalCodeRegex = /^\d{5}$/;
const frenchPhoneRegex = /^(?:\+33|0)[1-79]\d{8}$/;

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
    .string()
    .max(20, { message: 'Code postal trop long' })
    .default(''),
  country: z
    .string()
    .default('France'),
  countryCode: z
    .string()
    .length(2, { message: 'Le code pays doit contenir 2 caractères (ex: FR, BE, DE)' })
    .transform((v) => v.toUpperCase())
    .default('FR'),
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
    .max(20, { message: 'Code postal trop long' })
    .optional(),
  country: z.string().optional(),
  countryCode: z
    .string()
    .length(2, { message: 'Le code pays doit contenir 2 caractères (ex: FR, BE, DE)' })
    .transform((v) => v.toUpperCase())
    .optional(),
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
