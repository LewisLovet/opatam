import { z } from 'zod';

import { isValidInternationalPhone } from '../utils/phone';

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
    .refine((val) => isValidInternationalPhone(val), { message: 'Numéro de téléphone invalide' }),
});

/**
 * Client choices for a service with variations / options / infos. Holds
 * only IDs / answers — the server recomputes the price, duration and the
 * denormalised selection labels from the authoritative Service doc, so a
 * tampered payload can't change what the client pays.
 */
export const serviceSelectionsSchema = z.object({
  variations: z.record(z.string()),
  options: z.record(
    z.object({
      nestedVariations: z.record(z.string()),
      infoValues: z.record(z.string()),
    }),
  ),
  infoValues: z.record(z.string()),
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
  // Service variations / options / infos chosen by the client. Optional —
  // absent for plain services. Server recomputes price + duration from it.
  selections: serviceSelectionsSchema.optional(),
  // Multi-service appointment: prestations booked back-to-back in one visit.
  // When present, the booking spans the sum of their durations. The
  // top-level serviceId must equal items[0].serviceId (kept for back-compat).
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        selections: serviceSelectionsSchema.optional(),
      }),
    )
    .min(1)
    .optional(),
  // UI language the client booked in ('fr' | 'en'…). Drives the language of
  // every transactional email/notification sent to THIS client. Optional —
  // absent (legacy clients, pro-created bookings) falls back to French.
  clientLocale: z
    .string()
    .regex(/^[a-z]{2}$/, { message: 'Locale invalide' })
    .optional(),
  /**
   * Adresse de la cliente pour une prestation à DOMICILE (lieu mobile avec
   * travelZone). Seul le placeId fait foi : le serveur le résout lui-même
   * (Google Details, clé serveur) — les champs texte ne servent qu'à
   * l'affichage et ne sont jamais stockés tels quels.
   */
  clientAddress: z
    .object({
      placeId: z.string().min(5).max(300),
      address: z.string().max(300).default(''),
      city: z.string().max(100).default(''),
      postalCode: z.string().max(12).default(''),
      countryCode: z.string().length(2),
    })
    .optional(),
  /** Devis signé (HMAC, 15 min) renvoyé par /api/travel/quote — évite un recalcul. */
  travelQuoteToken: z.string().max(600).optional(),
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
  status: z.enum(['pending_payment', 'pending', 'confirmed', 'cancelled', 'completed', 'noshow'], {
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
  status: z.enum(['pending_payment', 'pending', 'confirmed', 'cancelled', 'completed', 'noshow']).optional(),
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
