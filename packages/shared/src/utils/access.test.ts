import { describe, it, expect } from 'vitest';
import {
  hasDepositAccess,
  isBaseTrialActive,
  isAccessOverrideActive,
} from './access';

const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);
const past = new Date(Date.now() - 24 * 3600 * 1000);
/** Firestore Timestamp-like (what the client SDK returns). */
const ts = (d: Date) => ({ toDate: () => d });

describe('isBaseTrialActive', () => {
  it('is active while trialing with a future validUntil (Date)', () => {
    expect(isBaseTrialActive({ status: 'trialing', validUntil: future })).toBe(true);
  });

  it('accepts a Firestore Timestamp validUntil', () => {
    expect(isBaseTrialActive({ status: 'trialing', validUntil: ts(future) })).toBe(true);
  });

  it('accepts an ISO string validUntil (serialized API payloads)', () => {
    expect(
      isBaseTrialActive({ status: 'trialing', validUntil: future.toISOString() }),
    ).toBe(true);
  });

  it('drops as soon as the trial expires — even with status still trialing', () => {
    // The base trial is local-only (no Stripe sub): it expires SILENTLY,
    // no webhook ever rewrites the status. Computing at read time is the fix.
    expect(isBaseTrialActive({ status: 'trialing', validUntil: past })).toBe(false);
  });

  it('is inactive without a validUntil', () => {
    expect(isBaseTrialActive({ status: 'trialing' })).toBe(false);
  });

  it('is inactive for any non-trialing status', () => {
    expect(isBaseTrialActive({ status: 'active', validUntil: future })).toBe(false);
    expect(isBaseTrialActive({ status: 'cancelled', validUntil: future })).toBe(false);
  });

  it('is inactive for null/undefined subscription', () => {
    expect(isBaseTrialActive(null)).toBe(false);
    expect(isBaseTrialActive(undefined)).toBe(false);
  });
});

describe('hasDepositAccess', () => {
  it('grants access during an active trial without the add-on', () => {
    expect(
      hasDepositAccess({
        depositsAddonActive: false,
        subscription: { status: 'trialing', validUntil: future },
      }),
    ).toBe(true);
  });

  it('grants access with the paid add-on (any base status)', () => {
    expect(
      hasDepositAccess({
        depositsAddonActive: true,
        subscription: { status: 'cancelled' },
      }),
    ).toBe(true);
  });

  it('denies an active paid base plan WITHOUT the add-on', () => {
    // The whole business model: base plan alone never includes deposits.
    expect(
      hasDepositAccess({
        depositsAddonActive: false,
        subscription: { status: 'active', validUntil: future },
      }),
    ).toBe(false);
  });

  it('denies once the trial expired without subscribing', () => {
    expect(
      hasDepositAccess({
        depositsAddonActive: false,
        subscription: { status: 'trialing', validUntil: past },
      }),
    ).toBe(false);
  });

  it('denies for a null provider', () => {
    expect(hasDepositAccess(null)).toBe(false);
    expect(hasDepositAccess(undefined)).toBe(false);
  });
});

describe('isAccessOverrideActive (régression après refactor toDate)', () => {
  it('active grant without end date = indefinite', () => {
    expect(isAccessOverrideActive({ active: true, until: null } as never)).toBe(true);
  });

  it('active grant with future end date', () => {
    expect(isAccessOverrideActive({ active: true, until: future } as never)).toBe(true);
  });

  it('expired grant', () => {
    expect(isAccessOverrideActive({ active: true, until: past } as never)).toBe(false);
  });

  it('inactive grant', () => {
    expect(isAccessOverrideActive({ active: false, until: future } as never)).toBe(false);
  });
});
