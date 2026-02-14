import { z } from 'zod';

// French phone regex: starts with 0, then 6 or 7, then 8 digits
const frenchPhoneRegex = /^0[67]\d{8}$/;

// Common validation patterns
const emailSchema = z
  .string({ required_error: 'L\'email est requis' })
  .email({ message: 'Format d\'email invalide' });

const passwordSchema = z
  .string({ required_error: 'Le mot de passe est requis' })
  .min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' });

const displayNameSchema = z
  .string({ required_error: 'Le nom est requis' })
  .min(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  .max(100, { message: 'Le nom ne peut pas dépasser 100 caractères' });

const phoneSchema = z
  .string()
  .regex(frenchPhoneRegex, { message: 'Numéro de téléphone invalide (format: 06/07 + 8 chiffres)' });

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Le mot de passe est requis' }).min(1, { message: 'Le mot de passe est requis' }),
});

// Register client schema
export const registerClientSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'La confirmation du mot de passe est requise' }),
  displayName: displayNameSchema,
  phone: phoneSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Register provider schema - Simplifie: juste l'authentification
// Les infos business sont ajoutees a l'onboarding, pas a l'inscription
export const registerProviderSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'La confirmation du mot de passe est requise' }),
  displayName: displayNameSchema,
  phone: phoneSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Reset password schema
export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string({ required_error: 'La confirmation du mot de passe est requise' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Le mot de passe actuel est requis' }).min(1, { message: 'Le mot de passe actuel est requis' }),
  newPassword: passwordSchema,
  confirmNewPassword: z.string({ required_error: 'La confirmation du mot de passe est requise' }),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmNewPassword'],
});

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterClientInput = z.infer<typeof registerClientSchema>;
export type RegisterProviderInput = z.infer<typeof registerProviderSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
