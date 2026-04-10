import { describe, it, expect } from 'vitest';
import { isValidPostalCode, isValidPhone } from './location.schema';

// --- Postal Code Validation ---
describe('isValidPostalCode', () => {
  it('validates French postal codes (5 digits)', () => {
    expect(isValidPostalCode('75001', 'FR')).toBe(true);
    expect(isValidPostalCode('91160', 'FR')).toBe(true);
    expect(isValidPostalCode('7500', 'FR')).toBe(false);
    expect(isValidPostalCode('750012', 'FR')).toBe(false);
    expect(isValidPostalCode('ABCDE', 'FR')).toBe(false);
  });

  it('validates Belgian postal codes (4 digits)', () => {
    expect(isValidPostalCode('1000', 'BE')).toBe(true);
    expect(isValidPostalCode('9999', 'BE')).toBe(true);
    expect(isValidPostalCode('0999', 'BE')).toBe(false); // starts with 0
    expect(isValidPostalCode('75001', 'BE')).toBe(false); // 5 digits
  });

  it('validates Luxembourg postal codes (4 digits, optional L- prefix)', () => {
    expect(isValidPostalCode('1536', 'LU')).toBe(true);
    expect(isValidPostalCode('L-1536', 'LU')).toBe(true);
    expect(isValidPostalCode('75001', 'LU')).toBe(false);
  });

  it('validates Swiss postal codes (4 digits)', () => {
    expect(isValidPostalCode('8001', 'CH')).toBe(true);
    expect(isValidPostalCode('1000', 'CH')).toBe(true);
    expect(isValidPostalCode('0100', 'CH')).toBe(false);
  });

  it('validates German postal codes (5 digits)', () => {
    expect(isValidPostalCode('10117', 'DE')).toBe(true);
    expect(isValidPostalCode('80331', 'DE')).toBe(true);
    expect(isValidPostalCode('1011', 'DE')).toBe(false);
  });

  it('validates Spanish postal codes (5 digits)', () => {
    expect(isValidPostalCode('28013', 'ES')).toBe(true);
    expect(isValidPostalCode('08001', 'ES')).toBe(true);
    expect(isValidPostalCode('52001', 'ES')).toBe(true);
    expect(isValidPostalCode('1234', 'ES')).toBe(false);   // too short
    expect(isValidPostalCode('123456', 'ES')).toBe(false);  // too long
  });

  it('validates Italian postal codes (5 digits)', () => {
    expect(isValidPostalCode('00184', 'IT')).toBe(true);
    expect(isValidPostalCode('20121', 'IT')).toBe(true);
  });

  it('validates Dutch postal codes (4 digits + 2 letters)', () => {
    expect(isValidPostalCode('1015 AA', 'NL')).toBe(true);
    expect(isValidPostalCode('1015AA', 'NL')).toBe(true);
    expect(isValidPostalCode('1015 aa', 'NL')).toBe(false); // lowercase
    expect(isValidPostalCode('75001', 'NL')).toBe(false);
  });

  it('validates Portuguese postal codes (NNNN-NNN)', () => {
    expect(isValidPostalCode('1100-053', 'PT')).toBe(true);
    expect(isValidPostalCode('4000-001', 'PT')).toBe(true);
    expect(isValidPostalCode('75001', 'PT')).toBe(false);
  });

  it('defaults to FR validation for unknown country', () => {
    expect(isValidPostalCode('75001', 'XX')).toBe(true);
    expect(isValidPostalCode('1000', 'XX')).toBe(false);
  });
});

// --- Phone Validation ---
describe('isValidPhone', () => {
  it('validates French phone numbers', () => {
    expect(isValidPhone('0612345678', 'FR')).toBe(true);
    expect(isValidPhone('+33612345678', 'FR')).toBe(true);
    expect(isValidPhone('06 12 34 56 78', 'FR')).toBe(true); // spaces stripped
    expect(isValidPhone('123456', 'FR')).toBe(false);
  });

  it('validates Belgian phone numbers', () => {
    expect(isValidPhone('0412345678', 'BE')).toBe(true);
    expect(isValidPhone('+32412345678', 'BE')).toBe(true);
  });

  it('validates German phone numbers', () => {
    expect(isValidPhone('015112345678', 'DE')).toBe(true);
    expect(isValidPhone('+4915112345678', 'DE')).toBe(true);
  });

  it('validates Spanish phone numbers', () => {
    expect(isValidPhone('612345678', 'ES')).toBe(true);
    expect(isValidPhone('+34612345678', 'ES')).toBe(true);
  });

  it('strips formatting characters before validation', () => {
    expect(isValidPhone('06.12.34.56.78', 'FR')).toBe(true);
    expect(isValidPhone('06-12-34-56-78', 'FR')).toBe(true);
  });
});
