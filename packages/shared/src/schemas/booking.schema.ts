import { z } from 'zod';

// Phone validation: accepts international formats
// - Minimum 8 digits, maximum 15 digits (E.164 standard)
// - Allows: +, spaces, dots, dashes, parentheses as formatting
// Examples: 0612345678, +33612345678, +33 6 12 34 56 78, +1 (555) 123-4567
const isValidPhone = (phone: string): boolean => {
  // Remove all formatting characters
  const cleaned = phone.replace(/[\s.\-()]/g, '');
  
  // Check if it starts with + or digits only
  if (!/^(\+)?[0-9]+$/.test(cleaned)) {
    return false;
  }
  
  // Count only digits (exclude +)
  const digitCount = cleaned.replace(/\D/g, '').length;
  
  // E.164 standard: 8-15 digits
  return digitCount >= 8 && digitCount <= 15;
};

// Client info schema (for non-logged-in users)
export const clientInfoSchema = z.object({
  name: z
    .string({ required_error: 'Le nom est requis' })
    .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
    .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' }),
  email: z
    .string({ required_error: 'L\'email est requis' })
    .email({ message: 'Format d\'email invalide' }),
  phone: z
    .string({ required_error: 'Le numéro de téléphone est requis' })
    .refine(isValidPhone, { message: 'Numéro de téléphone invalide' }),
});

// Create booking schema
export const createBookingSchema = z.object({
  providerId: z.string({ required_error: 'Le prestataire est requis' }).min(1),
  memberId: z.string().nullable().optional(),
  locationId: z.string({ required_error: 'Le lieu est requis' }).min(1),
  serviceId: z.string({ required_error: 'Le service est requis' }).min(1),
  datetime: z.coerce.date({ required_error: 'La date et l\'heure sont requises' }),
  clientInfo: clientInfoSchema.optional(),
  clientId: z.string().optional(),
  notes: z
    .string()
    .max(500, { message: 'Les notes ne peuvent pas dépasser 500 caractères' })
    .optional(),
}).refine(
  (data) => data.clientInfo !== undefined || data.clientId !== undefined,
  { message: 'Les informations du client sont requises' }
).refine(
  (data) => {
    const now = new Date();
    return data.datetime > now;
  },
  { message: 'La date de réservation doit être dans le futur' }
);

// Update booking status schema
export const updateBookingStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'noshow'], {
    required_error: 'Le statut est requis',
    invalid_type_error: 'Statut invalide',
  }),
  cancelReason: z
    .string()
    .max(200, { message: 'La raison d\'annulation ne peut pas dépasser 200 caractères' })
    .nullable()
    .optional(),
  cancelledBy: z.enum(['client', 'provider']).optional(),
});

// Reschedule booking schema
export const rescheduleBookingSchema = z.object({
  newDatetime: z.coerce.date({ required_error: 'La nouvelle date est requise' }),
  reason: z
    .string()
    .max(200, { message: 'La raison ne peut pas dépasser 200 caractères' })
    .optional(),
}).refine(
  (data) => {
    const now = new Date();
    return data.newDatetime > now;
  },
  { message: 'La nouvelle date doit être dans le futur' }
);

// Booking search/filter schema
export const bookingFilterSchema = z.object({
  providerId: z.string().optional(),
  memberId: z.string().optional(),
  locationId: z.string().optional(),
  serviceId: z.string().optional(),
  clientId: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'noshow']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// Export types
export type ClientInfoInput = z.infer<typeof clientInfoSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type BookingFilterInput = z.infer<typeof bookingFilterSchema>;
