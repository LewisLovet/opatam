import { z } from 'zod';

// Create review schema
export const createReviewSchema = z.object({
  providerId: z.string({ required_error: 'Le prestataire est requis' }).min(1),
  bookingId: z.string({ required_error: 'La réservation est requise' }).min(1),
  memberId: z.string().nullable().optional(),
  rating: z
    .number({ required_error: 'La note est requise' })
    .int({ message: 'La note doit être un nombre entier' })
    .min(1, { message: 'La note minimum est de 1 étoile' })
    .max(5, { message: 'La note maximum est de 5 étoiles' }),
  comment: z
    .string()
    .max(1000, { message: 'Le commentaire ne peut pas dépasser 1000 caractères' })
    .nullable()
    .optional(),
  tags: z
    .array(z.string().max(30))
    .max(5, { message: 'Maximum 5 tags autorisés' })
    .optional(),
});

// Update review schema (for editing)
export const updateReviewSchema = z.object({
  rating: z
    .number()
    .int({ message: 'La note doit être un nombre entier' })
    .min(1, { message: 'La note minimum est de 1 étoile' })
    .max(5, { message: 'La note maximum est de 5 étoiles' })
    .optional(),
  comment: z
    .string()
    .max(1000, { message: 'Le commentaire ne peut pas dépasser 1000 caractères' })
    .nullable()
    .optional(),
  tags: z
    .array(z.string().max(30))
    .max(5, { message: 'Maximum 5 tags autorisés' })
    .optional(),
});

// Provider response to review
export const reviewResponseSchema = z.object({
  response: z
    .string({ required_error: 'La réponse est requise' })
    .min(1, { message: 'La réponse ne peut pas être vide' })
    .max(500, { message: 'La réponse ne peut pas dépasser 500 caractères' }),
});

// ─── Imported reviews (admin) ──────────────────────────────────────
//
// Payload posted by the admin "import external reviews" flow. Each item
// is a single review parsed from a CSV (or entered manually). `Prenom`
// and `Mail` from the source file are intentionally DROPPED — we never
// import client identities. The rating is rounded + clamped to an integer
// 1..5 BEFORE validation so the rating trigger's integer distribution
// stays intact.

export const importReviewItemSchema = z.object({
  rating: z
    .number({ required_error: 'La note est requise' })
    .int({ message: 'La note doit être un nombre entier' })
    .min(1, { message: 'La note minimum est de 1 étoile' })
    .max(5, { message: 'La note maximum est de 5 étoiles' }),
  // Accept a real Date or an ISO string (the API receives JSON).
  createdAt: z.coerce.date({ required_error: 'La date est requise' }),
  comment: z
    .string()
    .max(2000, { message: 'Le commentaire ne peut pas dépasser 2000 caractères' })
    .nullable()
    .optional(),
  serviceLabel: z.string().max(200).nullable().optional(),
  sourceRef: z.string().max(100).nullable().optional(),
});

export const importReviewsSchema = z.object({
  providerId: z.string({ required_error: 'Le prestataire est requis' }).min(1),
  source: z
    .string({ required_error: 'La source est requise' })
    .min(1, { message: 'La source est requise' })
    .max(50),
  reviews: z
    .array(importReviewItemSchema)
    .min(1, { message: 'Au moins un avis est requis' })
    .max(2000, { message: 'Maximum 2000 avis par import' }),
  /** When true, email the provider a summary of the import (count + new rating). */
  notifyProvider: z.boolean().optional(),
});

// Review filter schema
export const reviewFilterSchema = z.object({
  providerId: z.string().optional(),
  memberId: z.string().optional(),
  clientId: z.string().optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  maxRating: z.number().int().min(1).max(5).optional(),
  hasComment: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  sortBy: z.enum(['rating', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Export types
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ReviewResponseInput = z.infer<typeof reviewResponseSchema>;
export type ReviewFilterInput = z.infer<typeof reviewFilterSchema>;
export type ImportReviewItemInput = z.infer<typeof importReviewItemSchema>;
export type ImportReviewsInput = z.infer<typeof importReviewsSchema>;
