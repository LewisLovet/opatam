import { z } from 'zod';

// Send message schema
export const sendMessageSchema = z.object({
  text: z
    .string({ required_error: 'Le message est requis' })
    .min(1, { message: 'Le message ne peut pas être vide' })
    .max(2000, { message: 'Le message ne peut pas dépasser 2000 caractères' }),
  attachments: z
    .array(
      z.object({
        type: z.enum(['image', 'file'], {
          invalid_type_error: 'Type de pièce jointe invalide',
        }),
        url: z.string().url({ message: 'URL de la pièce jointe invalide' }),
        name: z.string().max(100, { message: 'Le nom du fichier ne peut pas dépasser 100 caractères' }),
        size: z.number().int().positive().optional(),
      })
    )
    .max(5, { message: 'Maximum 5 pièces jointes autorisées' })
    .optional(),
});

// Create conversation schema
export const createConversationSchema = z.object({
  providerId: z.string({ required_error: 'Le prestataire est requis' }).min(1),
  clientId: z.string({ required_error: 'Le client est requis' }).min(1),
  bookingId: z.string().optional(),
  initialMessage: sendMessageSchema.optional(),
});

// Update conversation schema (mark as read, archive, etc.)
export const updateConversationSchema = z.object({
  isArchived: z.boolean().optional(),
  lastReadAt: z.coerce.date().optional(),
});

// Message filter schema
export const messageFilterSchema = z.object({
  conversationId: z.string().optional(),
  providerId: z.string().optional(),
  clientId: z.string().optional(),
  isArchived: z.boolean().optional(),
  hasUnread: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
  before: z.coerce.date().optional(),
  after: z.coerce.date().optional(),
});

// Export types
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type MessageFilterInput = z.infer<typeof messageFilterSchema>;
