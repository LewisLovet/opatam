// Regions
export * from './regions';

/**
 * Business categories for providers
 */
export const CATEGORIES = [
  { id: 'beauty', label: 'Beauté & Esthétique', icon: 'sparkles' },
  { id: 'wellness', label: 'Bien-être & Santé douce', icon: 'heart' },
  { id: 'sport', label: 'Sport & Coaching', icon: 'dumbbell' },
  { id: 'coaching', label: 'Coaching & Développement personnel', icon: 'lightbulb' },
  { id: 'audiovisual', label: 'Création & Audiovisuel', icon: 'camera' },
  { id: 'digital', label: 'Digital & Informatique', icon: 'laptop' },
  { id: 'artisan', label: 'Artisans & Services techniques', icon: 'wrench' },
  { id: 'home', label: 'Services à domicile', icon: 'home' },
  { id: 'training', label: 'Formation & Cours', icon: 'book' },
  { id: 'events', label: 'Événementiel', icon: 'music' },
  { id: 'consulting', label: 'Conseil & Services professionnels', icon: 'briefcase' },
  { id: 'mobility', label: 'Mobilité & Auto', icon: 'car' },
  { id: 'pets', label: 'Animaux', icon: 'paw' },
  { id: 'arts', label: 'Art & Loisirs', icon: 'palette' },
  { id: 'other', label: 'Autres services', icon: 'more-horizontal' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/**
 * Get the display label for a category id
 * Falls back to the id with first letter capitalized if not found
 */
export function getCategoryLabel(categoryId: string): string {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.label : categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

/**
 * Booking status labels
 */
export const BOOKING_STATUS = {
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirmé', color: 'success' },
  cancelled: { label: 'Annulé', color: 'error' },
  noshow: { label: 'Absent', color: 'error' },
} as const;

/**
 * Subscription plans
 */
export const SUBSCRIPTION_PLANS = {
  solo: {
    name: 'Pro',
    description: "L'essentiel pour les indépendants. Gérez vos rendez-vous et développez votre activité — sans commission.",
    monthlyPrice: 1790, // 17,90€ TTC
    yearlyPrice: 17900, // 179€ TTC (14,92€/mois — économie 17%)
    features: [
      'Réservations illimitées, 0% de commission',
      'Votre vitrine en ligne professionnelle',
      'Rappels automatiques email et push',
      'Agenda accessible partout, 24h/24',
      'Prêt en 5 minutes, sans formation',
    ],
  },
  team: {
    name: 'Studio',
    description: 'La solution complète pour les équipes. Coordonnez vos agendas, gérez plusieurs lieux et offrez une expérience pro.',
    baseMonthlyPrice: 2990, // 29,90€ TTC
    baseYearlyPrice: 23900, // 239€ TTC/an (19,92€/mois — économie 33%)
    features: [
      'Jusqu\'à 5 agendas synchronisés',
      '0% de commission, même en équipe',
      'Assignation des prestations par membre',
      'Multi-lieux (jusqu\'à 5 adresses)',
      'Page publique d\'équipe professionnelle',
      'Tout le plan Pro inclus',
    ],
  },
  test: {
    name: 'Test',
    description: 'Plan de test pour vérifier le flow de paiement. Accès complet, 0€.',
    monthlyPrice: 0, // Free plan for testing
    yearlyPrice: 0,
    features: [
      'Plan de test (0€)',
      'Vérification du flow de paiement',
      'Accès complet temporaire',
    ],
  },
} as const;

/**
 * Plan member limits
 */
export const PLAN_LIMITS = {
  solo: { maxMembers: 1, maxLocations: 1 },
  team: { maxMembers: 5, maxLocations: 5 },
  test: { maxMembers: 5, maxLocations: 5 },
} as const;

/**
 * Default reminder times in minutes
 */
export const DEFAULT_REMINDER_TIMES = [60, 1440] as const; // 1h and 24h

/**
 * Default notification settings for clients
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  pushEnabled: true,
  emailEnabled: true,
  reminderNotifications: true,
  confirmationNotifications: true,
  cancellationNotifications: true,
  rescheduleNotifications: true,
} as const;

/**
 * Default notification preferences for providers
 */
export const DEFAULT_PROVIDER_NOTIFICATION_PREFERENCES = {
  pushEnabled: true,
  emailEnabled: true,
  newBookingNotifications: true,
  confirmationNotifications: true,
  cancellationNotifications: true,
  reminderNotifications: true,
} as const;

/**
 * Default timezone
 */
export const DEFAULT_TIMEZONE = 'Europe/Paris';

/**
 * Days of week
 */
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
] as const;

/**
 * App configuration
 */
export const APP_CONFIG = {
  name: 'OPATAM',
  url: 'https://opatam.com',
  trialDays: 30,
  maxPortfolioPhotos: 10,
  maxMemberPhotoSize: 5 * 1024 * 1024, // 5MB
  reviewDeadlineDays: 14,
  defaultBufferTime: 15, // minutes
  slotInterval: 30, // minutes
} as const;

/**
 * Firebase Storage bucket URL
 */
const STORAGE_BUCKET = 'opatam-da04b.firebasestorage.app';
const ASSETS_BASE_URL = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o`;

/**
 * Asset URLs configuration
 * All logos are stored in Firebase Storage for centralized access
 *
 * Usage:
 * - ASSETS.logos.default - Main logo (fallback)
 * - ASSETS.logos.light - Logo for light backgrounds
 * - ASSETS.logos.dark - Logo for dark backgrounds
 * - ASSETS.logos.email - Optimized logo for emails (smaller, PNG)
 *
 * Helper function:
 * - getLogo('light') - Returns light logo, falls back to default if not available
 */
export const ASSETS = {
  logos: {
    default: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-default.png?alt=media`,
    light: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-light.png?alt=media`,
    dark: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-dark.png?alt=media`,
    email: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-email.png?alt=media`,
  },
} as const;

/**
 * Get logo URL with fallback to default
 * @param variant - 'light' | 'dark' | 'email' | 'default'
 * @param fallbackToDefault - If true, returns default logo URL as fallback
 */
export function getLogo(
  variant: 'light' | 'dark' | 'email' | 'default' = 'default',
  fallbackToDefault = true
): string {
  const logo = ASSETS.logos[variant];
  return fallbackToDefault ? logo || ASSETS.logos.default : logo;
}
