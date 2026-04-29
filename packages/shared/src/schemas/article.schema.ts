import { z } from 'zod';
import { ARTICLE_CATEGORIES } from '../types';

/**
 * Slug pattern: lowercase letters + digits + hyphens only.
 * Validated client-side and server-side to keep URLs predictable.
 */
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Optional URL field: accepts a valid URL, an empty string, null or undefined.
 * Empty strings are normalised to null BEFORE the URL check runs, so an
 * unfilled field never trips the URL validator.
 */
const optionalUrl = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
  z.string().trim().url({ message: 'URL invalide' }).nullable().optional()
);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, { message: `${label} : ${max} caractères max` })
    .nullable()
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v));

export const createArticleSchema = z.object({
  slug: z
    .string({ required_error: 'Le slug est requis' })
    .min(3, { message: 'Le slug doit faire au moins 3 caractères' })
    .max(80, { message: 'Le slug ne peut pas dépasser 80 caractères' })
    .regex(slugPattern, {
      message: 'Slug invalide : minuscules, chiffres et tirets uniquement (ex. "mon-article")',
    }),

  title: z
    .string({ required_error: 'Le titre est requis' })
    .min(5, { message: 'Le titre doit faire au moins 5 caractères' })
    .max(120, { message: 'Le titre ne peut pas dépasser 120 caractères' }),

  // Optional. If empty, the API auto-generates one from the body's first
  // ~160 characters. Editors don't need to write it manually.
  excerpt: z
    .string()
    .max(200, { message: "L'extrait ne peut pas dépasser 200 caractères" })
    .optional()
    .default(''),

  coverImageURL: optionalUrl,

  body: z
    .string({ required_error: 'Le contenu est requis' })
    .min(50, { message: 'Le contenu doit faire au moins 50 caractères' }),

  category: z.enum(ARTICLE_CATEGORIES as [string, ...string[]], {
    errorMap: () => ({ message: 'Catégorie invalide' }),
  }),

  isFeatured: z.boolean().default(false),

  videoUrl: optionalUrl,
  videoCoverURL: optionalUrl,

  // Author info is no longer editable — the API hardcodes "Équipe Opatam"
  // and the Opatam logo. Kept in the schema (optional) so older payloads
  // and updates that still send these don't break.
  authorName: z.string().trim().max(80).optional(),
  authorPhotoURL: optionalUrl,

  status: z.enum(['draft', 'published']).default('draft'),

  seoTitle: optionalText(70, 'Le titre SEO'),
  seoDescription: optionalText(160, 'La description SEO'),
  ogImageURL: optionalUrl,
});

export const updateArticleSchema = createArticleSchema.partial();

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
