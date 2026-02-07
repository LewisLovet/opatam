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
    name: 'Pro',
    description: "L'essentiel pour les independants. Gerez vos rendez-vous et developpez votre activite — sans commission.",
    monthlyPrice: 1490, // 14,90€ TTC
    yearlyPrice: 11900, // 119€ TTC (9,92€/mois — economie 33%)
    features: [
      'Reservations illimitees, 0% de commission',
      'Votre vitrine en ligne professionnelle',
      'Rappels automatiques email et push',
      'Agenda accessible partout, 24h/24',
      'Pret en 5 minutes, sans formation',
    ],
  },
  team: {
    name: 'Studio',
    description: 'La solution complete pour les equipes. Coordonnez vos agendas, gerez plusieurs lieux et offrez une experience pro.',
    baseMonthlyPrice: 2990, // 29,90€ TTC (inclut 1 membre)
    memberMonthlyPrice: 990, // +9,90€/membre supplementaire
    baseYearlyPrice: 23900, // 239€ TTC/an (19,92€/mois — economie 33%)
    memberYearlyPrice: 7900, // +79€/membre sup./an (6,58€/mois — economie 34%)
    features: [
      'Jusqu\'a 5 agendas synchronises',
      '0% de commission, meme en equipe',
      'Assignation des prestations par membre',
      'Multi-lieux (jusqu\'a 5 adresses)',
      'Page publique d\'equipe professionnelle',
      'Tout le plan Pro inclus',
    ],
  },
  test: {
    name: 'Test',
    description: 'Plan de test pour verifier le flow de paiement. Acces complet, 0€.',
    monthlyPrice: 0, // Free plan for testing
    yearlyPrice: 0,
    features: [
      'Plan de test (0€)',
      'Verification du flow de paiement',
      'Acces complet temporaire',
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
