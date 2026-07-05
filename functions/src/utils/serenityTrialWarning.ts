/**
 * Sérénité trial-ending warning (J-3) — eligibility logic.
 *
 * Deposits are included for free during the base trial. ~3 days before the
 * trial ends, pros who actually USE the feature (active Stripe Connect —
 * Connect only exists for deposits) and don't have the paid add-on get one
 * warning email so the cutoff never takes them by surprise.
 *
 * The predicate is pure (unit-tested in ../../test) — the cron and the admin
 * test callable share it.
 */

/** Days before trial end from which the warning may fire. */
export const WARN_WINDOW_DAYS = 3;

export interface SerenityWarnInput {
  /** provider.subscription.status */
  subscriptionStatus: string | null | undefined;
  /** provider.subscription.validUntil (already converted to Date, or null). */
  validUntil: Date | null;
  /** provider.stripeConnectStatus */
  stripeConnectStatus: string | null | undefined;
  /** provider.depositsAddonActive */
  depositsAddonActive: boolean | null | undefined;
  /** provider.serenityTrialWarnAt — non-null = already warned once. */
  alreadyWarned: boolean;
}

export type SerenityWarnVerdict =
  | { warn: true }
  | { warn: false; reason: string };

export function shouldWarnSerenityTrialEnding(
  input: SerenityWarnInput,
  now: Date = new Date(),
): SerenityWarnVerdict {
  if (input.alreadyWarned) return { warn: false, reason: 'already-warned' };
  if (input.subscriptionStatus !== 'trialing') {
    return { warn: false, reason: 'not-trialing' };
  }
  if (!input.validUntil || isNaN(input.validUntil.getTime())) {
    return { warn: false, reason: 'no-valid-until' };
  }
  const msLeft = input.validUntil.getTime() - now.getTime();
  if (msLeft <= 0) return { warn: false, reason: 'trial-expired' };
  if (msLeft > WARN_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
    return { warn: false, reason: 'too-early' };
  }
  if (input.depositsAddonActive) {
    return { warn: false, reason: 'addon-already-active' };
  }
  // "Uses deposits" signal: a fully active Connect account. Pending/restricted
  // accounts can't collect anyway, and emailing them would push a subscription
  // for a feature that doesn't run yet.
  if (input.stripeConnectStatus !== 'active') {
    return { warn: false, reason: 'connect-not-active' };
  }
  return { warn: true };
}
