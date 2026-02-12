import { z } from 'zod';

export const createServiceCategorySchema = z.object({
  name: z
    .string({ required_error: 'Le nom de la catégorie est requis' })
    .min(1, { message: 'Le nom ne peut pas être vide' })
    .max(50, { message: 'Le nom ne peut pas dépasser 50 caractères' }),
});

export const updateServiceCategorySchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Le nom ne peut pas être vide' })
    .max(50, { message: 'Le nom ne peut pas dépasser 50 caractères' })
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
