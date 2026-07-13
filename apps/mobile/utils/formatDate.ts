/**
 * Date formatting utilities
 */

import i18n from '../lib/i18n';

/**
 * Format a date as relative time (e.g., "Il y a 2 jours" / "2 days ago")
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return i18n.t('dates.today');
  if (diffDays === 1) return i18n.t('dates.yesterday');
  if (diffDays < 7) return i18n.t('dates.daysAgo', { count: diffDays });

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 30) return i18n.t('dates.weeksAgo', { count: diffWeeks });

  const diffMonths = Math.floor(diffDays / 30);
  if (diffDays < 365) return i18n.t('dates.monthsAgo', { count: diffMonths });

  const diffYears = Math.floor(diffDays / 365);
  return i18n.t('dates.yearsAgo', { count: diffYears });
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
