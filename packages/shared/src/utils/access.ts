import type { AccessOverride } from '../types';

/** Firestore Timestamp / Date / ISO string / epoch → Date (null if invalid). */
function toDate(raw: unknown): Date | null {
  let d: Date | null = null;
  if (raw instanceof Date) {
    d = raw;
  } else if (typeof (raw as { toDate?: () => Date })?.toDate === 'function') {
    d = (raw as { toDate: () => Date }).toDate();
  } else if (typeof raw === 'string' || typeof raw === 'number') {
    d = new Date(raw);
  }
  return d && !isNaN(d.getTime()) ? d : null;
}

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
  const until = toDate(override.until);
  return !!until && until.getTime() > Date.now();
}

/**
 * Whether the provider's FREE base trial is currently running.
 *
 * The trial is local-only (no Stripe/RevenueCat subscription behind it): it is
 * seeded at signup as `subscription.status: 'trialing'` + `validUntil`, and can
 * expire silently without any webhook. Gates must therefore COMPUTE this at
 * read time — never materialize it into a flag.
 */
export function isBaseTrialActive(
  subscription: { status?: string | null; validUntil?: unknown } | null | undefined,
): boolean {
  if (!subscription || subscription.status !== 'trialing') return false;
  const until = toDate(subscription.validUntil);
  return !!until && until.getTime() > Date.now();
}

/**
 * Deposits (Sérénité) access gate — the ONE rule for whether a provider may
 * configure and collect deposits:
 *   - paid Sérénité add-on or admin comp (both materialized into
 *     `depositsAddonActive` by the webhook / admin route), OR
 *   - the free base trial is running (deposits are included in the trial so
 *     pros experience them before paying; access drops by itself when the
 *     trial ends since this is computed at read time).
 *
 * Collecting still ALWAYS requires an active Stripe Connect account on top —
 * that guardrail is checked separately and never bypassed.
 */
export function hasDepositAccess(
  provider:
    | {
        depositsAddonActive?: boolean | null;
        subscription?: { status?: string | null; validUntil?: unknown } | null;
      }
    | null
    | undefined,
): boolean {
  if (!provider) return false;
  if (provider.depositsAddonActive) return true;
  return isBaseTrialActive(provider.subscription);
}
