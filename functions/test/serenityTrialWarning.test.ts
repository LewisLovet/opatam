import { describe, it, expect } from 'vitest';
import {
  shouldWarnSerenityTrialEnding,
  WARN_WINDOW_DAYS,
  type SerenityWarnInput,
} from '../src/utils/serenityTrialWarning';

const NOW = new Date('2026-07-05T10:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

/** Eligible baseline: trialing, ends in 2 days, Connect active, no add-on. */
function base(overrides: Partial<SerenityWarnInput> = {}): SerenityWarnInput {
  return {
    subscriptionStatus: 'trialing',
    validUntil: days(2),
    stripeConnectStatus: 'active',
    depositsAddonActive: false,
    alreadyWarned: false,
    ...overrides,
  };
}

describe('shouldWarnSerenityTrialEnding', () => {
  it('warns an eligible trial pro ending within the window', () => {
    expect(shouldWarnSerenityTrialEnding(base(), NOW)).toEqual({ warn: true });
  });

  it('warns right at the window edge (exactly J-3)', () => {
    const v = shouldWarnSerenityTrialEnding(
      base({ validUntil: days(WARN_WINDOW_DAYS) }),
      NOW,
    );
    expect(v.warn).toBe(true);
  });

  it('does not warn before the window (J-4)', () => {
    const v = shouldWarnSerenityTrialEnding(base({ validUntil: days(4) }), NOW);
    expect(v).toEqual({ warn: false, reason: 'too-early' });
  });

  it('does not warn once the trial is already over', () => {
    const v = shouldWarnSerenityTrialEnding(base({ validUntil: days(-1) }), NOW);
    expect(v).toEqual({ warn: false, reason: 'trial-expired' });
  });

  it('never warns twice', () => {
    const v = shouldWarnSerenityTrialEnding(base({ alreadyWarned: true }), NOW);
    expect(v).toEqual({ warn: false, reason: 'already-warned' });
  });

  it('ignores non-trial subscriptions (paid subs share the validUntil window)', () => {
    const v = shouldWarnSerenityTrialEnding(
      base({ subscriptionStatus: 'active' }),
      NOW,
    );
    expect(v).toEqual({ warn: false, reason: 'not-trialing' });
  });

  it('skips pros who never set up Connect (they do not use deposits)', () => {
    const v = shouldWarnSerenityTrialEnding(
      base({ stripeConnectStatus: null }),
      NOW,
    );
    expect(v).toEqual({ warn: false, reason: 'connect-not-active' });
  });

  it('skips pending/restricted Connect accounts', () => {
    const v = shouldWarnSerenityTrialEnding(
      base({ stripeConnectStatus: 'pending' }),
      NOW,
    );
    expect(v).toEqual({ warn: false, reason: 'connect-not-active' });
  });

  it('skips pros who already pay for the add-on (comp included)', () => {
    const v = shouldWarnSerenityTrialEnding(
      base({ depositsAddonActive: true }),
      NOW,
    );
    expect(v).toEqual({ warn: false, reason: 'addon-already-active' });
  });

  it('handles a missing validUntil defensively', () => {
    const v = shouldWarnSerenityTrialEnding(base({ validUntil: null }), NOW);
    expect(v).toEqual({ warn: false, reason: 'no-valid-until' });
  });

  it('handles an invalid validUntil defensively', () => {
    const v = shouldWarnSerenityTrialEnding(
      base({ validUntil: new Date('invalid') }),
      NOW,
    );
    expect(v).toEqual({ warn: false, reason: 'no-valid-until' });
  });
});
