// Zod validation helpers — turn ZodError into a readable message so the
// UI never shows a raw JSON array of issues.
export * from './zod';
// Manual "comp" access grant helper (admin-granted access without payment).
export * from './access';
// Address-privacy helpers (protected à-domicile addresses revealed ~48h before).
export * from './address';
// Service variation/option/info builders + sanitizers (shared web + mobile).
export * from './serviceChoices';
// Provider business stats — pure aggregation logic (daily + monthly
// + rolling). See ./providerStats.ts for the full pipeline.
export * from './providerStats';
// Per-provider client base aggregation (CRM-lite). Same pattern,
// fed by the same booking write trigger. See ./providerClients.ts.
export * from './providerClients';
// Stats period utilities (used by /pro/statistiques on web and the
// equivalent screen on mobile — pure TS, no platform deps).
export * from './statsPeriod';
// Client-side roll-up helpers — sum daily/monthly docs into KPIs +
// build continuous trend series for charts.
export * from './statsAggregate';
// YouTube URL helpers — used by the blog article renderer (web)
// and the in-app tutoriels screen (mobile).
export * from './youtube';
// Markdown helpers — heading extraction + slugifier shared between
// the web blog sidebar TOC and the mobile inline sommaire.
export * from './markdown';
// Service pricing — pure compute helpers for the variations / options
// system. Used by the admin wizard preview, the booking picker, and
// the public fiche's "À partir de" display.
export * from './service-pricing';
// Article freshness — the "Nouveau" pill recency check used by both
// the web blog cards and the mobile in-app tutoriels list.
export * from './articles';

/**
 * Format price from cents to display string
 * @param cents - Price in cents
 * @param currency - Currency code (default: EUR)
 * @param locale - BCP 47 locale for number formatting (default: fr-FR —
 *   pass the active UI locale on translated surfaces)
 * @returns Formatted price string
 */
export function formatPrice(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  // "Free" is the only translated word here — a full dictionary lookup would
  // drag react/i18n into shared, so a tiny inline map does the job.
  if (cents === 0) return locale.startsWith('en') ? 'Free' : 'Gratuit';
  const amount = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format duration in minutes to human readable string
 * @param minutes - Duration in minutes
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes}`;
}

/**
 * Generate a unique access code for team members
 * Format: NAME-XXXX where X is alphanumeric
 * @param name - Member name
 * @returns Generated access code
 */
export function generateAccessCode(name: string): string {
  const sanitizedName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);

  const randomPart = Math.random()
    .toString(36)
    .substring(2, 6)
    .toUpperCase();

  return `${sanitizedName}-${randomPart}`;
}

/**
 * Generate a unique cancel token for bookings
 * @returns Random token string
 */
export function generateCancelToken(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Generate a URL-friendly slug from a string
 * @param text - Text to convert to slug
 * @returns URL-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Check if a date is in the past
 * @param date - Date to check
 * @returns True if date is in the past
 */
export function isPastDate(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Get the day of week name
 * @param dayOfWeek - Day number (0 = Sunday, 6 = Saturday)
 * @param locale - Locale for formatting (default: fr-FR)
 * @returns Day name
 */
export function getDayName(dayOfWeek: number, locale = 'fr-FR'): string {
  const date = new Date(2024, 0, dayOfWeek); // January 2024 starts on Monday
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
}

/**
 * Parse time string to minutes from midnight
 * @param time - Time string in HH:MM format
 * @returns Minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Minutes from midnight for a window/slot END time.
 * A time range ending at "00:00" means midnight = END OF DAY (24:00 = 1440 min),
 * not the start of the day (0). Use this (instead of `timeToMinutes`) whenever a
 * value represents the END of a range — availability windows, breaks, bookings —
 * so a range like 19:00→00:00 has a positive duration and renders/computes right.
 * (A START of "00:00" must keep using `timeToMinutes` → 0.)
 * @param time - Time string in HH:MM format
 * @returns Minutes from midnight, with "00:00" treated as 1440
 */
export function endTimeToMinutes(time: string): number {
  const minutes = timeToMinutes(time);
  return minutes === 0 ? 24 * 60 : minutes;
}

/**
 * Convert minutes from midnight to time string
 * @param minutes - Minutes from midnight
 * @returns Time string in HH:MM format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate end time for a booking
 * @param startTime - Start datetime
 * @param durationMinutes - Duration in minutes
 * @param bufferMinutes - Buffer time in minutes (default: 0)
 * @returns End datetime
 */
export function calculateEndTime(
  startTime: Date,
  durationMinutes: number,
  bufferMinutes = 0
): Date {
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes + bufferMinutes);
  return endTime;
}

/**
 * Calculate distance between two geopoints using the Haversine formula
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format a distance in km to a human-readable string
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Normalize city name for search optimization
 * - Trim whitespace
 * - Convert to lowercase
 * - Remove accents (é → e, etc.)
 * - Replace multiple spaces with single space
 * @param city - City name to normalize
 * @returns Normalized city name
 */
export function normalizeCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Capitalize each word in a string (for display of normalized cities)
 * Handles separators: spaces, hyphens, apostrophes
 * Ex: "saint-etienne" → "Saint-Etienne", "l'isle-adam" → "L'Isle-Adam"
 */
export function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/(^|[\s\-'])(\w)/g, (_, sep, char) => sep + char.toUpperCase());
}

/**
 * Generate search tokens from a business name
 * - Splits into words
 * - Normalizes each word (lowercase, no accents)
 * - Generates all prefixes of each word (min 3 chars) for prefix search
 * @param businessName - Business name to tokenize
 * @returns Array of normalized search tokens including prefixes
 */
export function generateSearchTokens(businessName: string): string[] {
  const words = businessName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .split(/\s+/) // Split on whitespace
    .map((word) => word.replace(/[^a-z0-9]/g, '')) // Keep only alphanumeric
    .filter((word) => word.length >= 3); // Filter short words

  const tokens = new Set<string>();

  for (const word of words) {
    // Add all prefixes from 3 chars to full word
    for (let i = 3; i <= word.length; i++) {
      tokens.add(word.slice(0, i));
    }
  }

  return Array.from(tokens);
}

// ────────────────────────────────────────────────────────────
// Deposits resolution
// ────────────────────────────────────────────────────────────

/** Minimal shape needed by `resolveDeposit` — works with both partial
 *  Service docs and the full type. */
interface ServiceForDeposit {
  price: number;
  deposit?: {
    type: 'fixed' | 'percent' | 'none';
    value?: number;
    refundDeadlineHours?: number;
  } | null;
}

interface ProviderSettingsForDeposit {
  depositDefault?: {
    percent: number;
    refundDeadlineHours: number;
  } | null;
}

/**
 * Resolve the deposit amount for a given service. Three states are
 * possible on `service.deposit`:
 *
 *   - `null` / undefined → fall back to `providerSettings.depositDefault`
 *   - `{ type: 'none' }` → explicitly disabled, ignore the default
 *   - `{ type: 'fixed' | 'percent', ... }` → custom override
 *
 * Returns null when no deposit is required.
 *
 * Pure function — used both client-side (booking flow preview) and
 * server-side (booking creation, refund logic).
 */
export function resolveDeposit(
  service: ServiceForDeposit,
  providerSettings: ProviderSettingsForDeposit
): {
  amount: number;              // cents
  refundDeadlineHours: number;
  source: 'service' | 'default';
} | null {
  if (service.deposit) {
    if (service.deposit.type === 'none') {
      // Explicitly opted out of any deposit on this service.
      return null;
    }
    const value = service.deposit.value ?? 0;
    const amount =
      service.deposit.type === 'fixed'
        ? value
        : Math.round((service.price * value) / 100);
    // A 0€ deposit is no deposit: it would show a pointless opt-in in
    // the booking UIs and, server-side, put the booking in
    // pending_payment behind a 0-amount Stripe Checkout.
    if (amount <= 0) return null;
    return {
      amount,
      refundDeadlineHours: service.deposit.refundDeadlineHours ?? 24,
      source: 'service',
    };
  }
  if (providerSettings.depositDefault) {
    const amount = Math.round(
      (service.price * providerSettings.depositDefault.percent) / 100
    );
    if (amount <= 0) return null;
    return {
      amount,
      refundDeadlineHours: providerSettings.depositDefault.refundDeadlineHours,
      source: 'default',
    };
  }
  return null;
}
