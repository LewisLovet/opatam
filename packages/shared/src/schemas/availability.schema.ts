import { z } from 'zod';

// Time format regex: HH:mm (24-hour format)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Time slot schema
export const timeSlotSchema = z.object({
  start: z
    .string({ required_error: 'L\'heure de début est requise' })
    .regex(timeRegex, { message: 'Format d\'heure invalide (HH:mm)' }),
  end: z
    .string({ required_error: 'L\'heure de fin est requise' })
    .regex(timeRegex, { message: 'Format d\'heure invalide (HH:mm)' }),
}).refine(
  (data) => {
    const [startHour, startMin] = data.start.split(':').map(Number);
    const [endHour, endMin] = data.end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  { message: 'L\'heure de fin doit être après l\'heure de début' }
);

// Availability schema (for a day of week)
// Centré sur le membre : 1 membre = 1 lieu = 1 agenda
export const availabilitySchema = z.object({
  memberId: z.string({ required_error: 'Le membre est requis' }),
  locationId: z.string({ required_error: 'Le lieu est requis' }), // Dénormalisé depuis member.locationId
  dayOfWeek: z
    .number({ required_error: 'Le jour de la semaine est requis' })
    .int()
    .min(0, { message: 'Le jour doit être entre 0 (dimanche) et 6 (samedi)' })
    .max(6, { message: 'Le jour doit être entre 0 (dimanche) et 6 (samedi)' }),
  slots: z.array(timeSlotSchema),
  isOpen: z.boolean().default(true),
  effectiveFrom: z.coerce.date().nullable().optional(), // Date d'effet pour changements planifiés
});

// Availability conflict schema (for conflict detection)
export const availabilityConflictSchema = z.object({
  bookingId: z.string(),
  bookingDate: z.coerce.date(),
  clientName: z.string(),
  serviceName: z.string(),
  conflictType: z.enum(['reduced_hours', 'day_closed']),
});

// Set availability schema (for multiple days)
export const setAvailabilitySchema = z.object({
  memberId: z.string({ required_error: 'Le membre est requis' }),
  locationId: z.string({ required_error: 'Le lieu est requis' }), // Dénormalisé depuis member.locationId
  schedule: z.array(
    z.object({
      dayOfWeek: z
        .number()
        .int()
        .min(0, { message: 'Le jour doit être entre 0 (dimanche) et 6 (samedi)' })
        .max(6, { message: 'Le jour doit être entre 0 (dimanche) et 6 (samedi)' }),
      slots: z.array(timeSlotSchema),
      isOpen: z.boolean().default(true),
    })
  ).length(7, { message: 'L\'emploi du temps doit contenir 7 jours' }),
});

// Blocked slot schema (vacation, break, etc.)
// Centré sur le membre
export const blockedSlotSchema = z.object({
  memberId: z.string({ required_error: 'Le membre est requis' }),
  locationId: z.string({ required_error: 'Le lieu est requis' }), // Dénormalisé depuis member.locationId
  startDate: z.coerce.date({ required_error: 'La date de début est requise' }),
  endDate: z.coerce.date({ required_error: 'La date de fin est requise' }),
  allDay: z.boolean().default(false),
  startTime: z
    .string()
    .regex(timeRegex, { message: 'Format d\'heure invalide (HH:mm)' })
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(timeRegex, { message: 'Format d\'heure invalide (HH:mm)' })
    .nullable()
    .optional(),
  reason: z
    .string()
    .max(200, { message: 'La raison ne peut pas dépasser 200 caractères' })
    .nullable()
    .optional(),
  // Activity fields — when both are set, the entry is treated as a
  // life-planner activity (sport, meeting, …) rather than a generic
  // blocked period. The slot-availability pipeline doesn't care
  // either way: both flavors block the calendar.
  category: z
    .enum([
      // Keep in sync with the ActivityCategory union in
      // packages/shared/src/types/index.ts. `prestation` is listed
      // first because it's the default category for paid
      // off-platform work — see the type comment.
      'prestation',
      'sport',
      'meeting',
      'personal',
      'admin',
      'travel',
      'imprevu',
      'other',
    ])
    .nullable()
    .optional(),
  title: z
    .string()
    .max(80, { message: 'Le titre ne peut pas dépasser 80 caractères' })
    .nullable()
    .optional(),
  address: z
    .string()
    .max(200, { message: 'L\'adresse ne peut pas dépasser 200 caractères' })
    .nullable()
    .optional(),
  /** Amount earned in cents — for paid activities (off-platform
   *  workshops, freelance gigs, etc.). Capped at 1 M€ to catch
   *  mis-entered amounts (e.g. forgetting cents). */
  amount: z
    .number()
    .int({ message: 'Le montant doit être en centimes (entier)' })
    .min(0, { message: 'Le montant doit être positif ou nul' })
    .max(100_000_000, { message: 'Montant trop élevé' })
    .nullable()
    .optional(),
  isRecurring: z.boolean().default(false),
  recurringDays: z
    .array(z.number().int().min(0).max(6))
    .optional(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'La date de fin doit être après ou égale à la date de début' }
).refine(
  (data) => {
    if (data.allDay) return true;
    return data.startTime !== null && data.endTime !== null;
  },
  { message: 'Les heures de début et de fin sont requises pour les créneaux non journée entière' }
);

// Exception slot schema (one-time override)
export const exceptionSlotSchema = z.object({
  memberId: z.string({ required_error: 'Le membre est requis' }),
  locationId: z.string({ required_error: 'Le lieu est requis' }), // Dénormalisé depuis member.locationId
  date: z.coerce.date({ required_error: 'La date est requise' }),
  slots: z.array(timeSlotSchema),
  isOpen: z.boolean().default(true),
  reason: z
    .string()
    .max(200, { message: 'La raison ne peut pas dépasser 200 caractères' })
    .nullable()
    .optional(),
});

// Export types
export type TimeSlotInput = z.infer<typeof timeSlotSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type BlockedSlotInput = z.infer<typeof blockedSlotSchema>;
export type ExceptionSlotInput = z.infer<typeof exceptionSlotSchema>;
export type AvailabilityConflictInput = z.infer<typeof availabilityConflictSchema>;
