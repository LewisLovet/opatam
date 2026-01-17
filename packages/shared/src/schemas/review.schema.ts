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
