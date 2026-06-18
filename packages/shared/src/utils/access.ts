import type { AccessOverride } from '../types';

/**
 * Whether a manual "comp" access grant is currently in effect.
 *
 * Used by every access gate (web layout, /api/bookings, mobile
 * useSubscriptionStatus) and by the cancellation webhook (to skip unpublishing
 * comped providers). Robust to `until` arriving as a Date, a Firestore
 * Timestamp, or an ISO string, depending on how the doc was read.
 */
export function isAccessOverrideActive(override: AccessOverride | null | undefined): boolean {
  if (!override?.active) return false;
  if (!override.until) return true; // indefinite grant

  const raw: unknown = override.until;
  let until: Date | null = null;
  if (raw instanceof Date) {
    until = raw;
  } else if (typeof (raw as { toDate?: () => Date })?.toDate === 'function') {
    until = (raw as { toDate: () => Date }).toDate();
  } else if (typeof raw === 'string' || typeof raw === 'number') {
    until = new Date(raw);
  }

  return !!until && !isNaN(until.getTime()) && until.getTime() > Date.now();
}
