/**
 * Format price from cents to display string
 * @param cents - Price in cents
 * @param currency - Currency code (default: EUR)
 * @returns Formatted price string
 */
export function formatPrice(cents: number, currency = 'EUR'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
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
