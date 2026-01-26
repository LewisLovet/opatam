/**
 * Date formatting utilities
 */

/**
 * Format a date as relative time (e.g., "Il y a 2 jours")
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 30) return `Il y a ${diffWeeks} semaine${diffWeeks > 1 ? 's' : ''}`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffDays < 365) return `Il y a ${diffMonths} mois`;

  const diffYears = Math.floor(diffDays / 365);
  return `Il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
}

/**
 * Format time from "HH:MM" string to display format
 */
export function formatTime(time: string): string {
  return time; // Already in HH:MM format
}

/**
 * Calculate duration in minutes between two time strings
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}
