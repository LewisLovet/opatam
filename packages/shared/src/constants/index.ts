/**
 * Business categories for providers
 */
export const CATEGORIES = [
  { id: 'beauty', label: 'Beaute & Esthetique', icon: 'sparkles' },
  { id: 'wellness', label: 'Bien-etre & Sante douce', icon: 'heart' },
  { id: 'sport', label: 'Sport & Coaching', icon: 'dumbbell' },
  { id: 'coaching', label: 'Coaching & Developpement personnel', icon: 'lightbulb' },
  { id: 'audiovisual', label: 'Creation & Audiovisuel', icon: 'camera' },
  { id: 'digital', label: 'Digital & Informatique', icon: 'laptop' },
  { id: 'artisan', label: 'Artisans & Services techniques', icon: 'wrench' },
  { id: 'home', label: 'Services a domicile', icon: 'home' },
  { id: 'training', label: 'Formation & Cours', icon: 'book' },
  { id: 'events', label: 'Evenementiel', icon: 'music' },
  { id: 'consulting', label: 'Conseil & Services professionnels', icon: 'briefcase' },
  { id: 'mobility', label: 'Mobilite & Auto', icon: 'car' },
  { id: 'pets', label: 'Animaux', icon: 'paw' },
  { id: 'arts', label: 'Art & Loisirs', icon: 'palette' },
  { id: 'other', label: 'Autres services', icon: 'more-horizontal' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/**
 * Booking status labels
 */
export const BOOKING_STATUS = {
  pending: { label: 'En attente', color: 'warning' },
  confirmed: { label: 'Confirme', color: 'success' },
  cancelled: { label: 'Annule', color: 'error' },
  noshow: { label: 'Absent', color: 'error' },
} as const;

/**
 * Subscription plans
 */
export const SUBSCRIPTION_PLANS = {
  solo: {
    name: 'Solo',
    monthlyPrice: 1500, // cents
    yearlyPrice: 10000, // cents
    features: [
      '1 agenda',
      'Reservations illimitees',
      'Notifications email et push',
      'Page publique personnalisee',
    ],
  },
  team: {
    name: 'Team',
    baseMonthlyPrice: 1500, // cents
    memberMonthlyPrice: 1000, // cents per member
    baseYearlyPrice: 10000, // cents
    memberYearlyPrice: 8000, // cents per member per year
    features: [
      'Multi-agendas',
      'Gestion des membres',
      'Assignation des prestations',
      'Planning individuel par membre',
    ],
  },
} as const;

/**
 * Default reminder times in minutes
 */
export const DEFAULT_REMINDER_TIMES = [60, 1440] as const; // 1h and 24h

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
  trialDays: 7,
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
