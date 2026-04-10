import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatDuration,
  generateAccessCode,
  generateCancelToken,
  generateSlug,
  isPastDate,
  timeToMinutes,
  minutesToTime,
  calculateEndTime,
  haversineDistance,
  formatDistance,
  normalizeCity,
  capitalizeWords,
  generateSearchTokens,
} from './index';

// --- formatPrice ---
describe('formatPrice', () => {
  it('returns "Gratuit" for 0 cents', () => {
    expect(formatPrice(0)).toBe('Gratuit');
  });

  it('formats cents to EUR string', () => {
    const result = formatPrice(3500);
    expect(result).toContain('35');
    expect(result).toContain('€');
  });

  it('handles single digit cents', () => {
    const result = formatPrice(50);
    expect(result).toContain('0,50');
  });

  it('handles large amounts', () => {
    const result = formatPrice(999900);
    expect(result).toContain('9');
  });
});

// --- formatDuration ---
describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(30)).toBe('30min');
    expect(formatDuration(5)).toBe('5min');
  });

  it('formats exact hours', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(150)).toBe('2h30');
    expect(formatDuration(75)).toBe('1h15');
  });
});

// --- generateAccessCode ---
describe('generateAccessCode', () => {
  it('returns NAME-XXXX format', () => {
    const code = generateAccessCode('Jean');
    expect(code).toMatch(/^[A-Z]+-[A-Z0-9]{4}$/);
  });

  it('removes accents from name', () => {
    const code = generateAccessCode('Éloïse');
    expect(code.split('-')[0]).toBe('ELOISE');
  });

  it('truncates long names to 6 chars', () => {
    const code = generateAccessCode('Alexandrine');
    expect(code.split('-')[0].length).toBeLessThanOrEqual(6);
  });

  it('generates unique codes', () => {
    const code1 = generateAccessCode('Test');
    const code2 = generateAccessCode('Test');
    // Random part should differ (extremely unlikely to match)
    expect(code1).not.toBe(code2);
  });
});

// --- generateCancelToken ---
describe('generateCancelToken', () => {
  it('generates a non-empty string', () => {
    const token = generateCancelToken();
    expect(token.length).toBeGreaterThan(10);
  });

  it('generates unique tokens', () => {
    const token1 = generateCancelToken();
    const token2 = generateCancelToken();
    expect(token1).not.toBe(token2);
  });
});

// --- generateSlug ---
describe('generateSlug', () => {
  it('converts to lowercase', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('removes accents', () => {
    expect(generateSlug('Café Étoilé')).toBe('cafe-etoile');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('mon salon de coiffure')).toBe('mon-salon-de-coiffure');
  });

  it('removes special characters', () => {
    expect(generateSlug('Salon & Spa !')).toBe('salon-spa');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('a  --  b')).toBe('a-b');
  });

  it('trims whitespace', () => {
    expect(generateSlug('  test  ')).toBe('test');
  });
});

// --- isPastDate ---
describe('isPastDate', () => {
  it('returns true for past dates', () => {
    expect(isPastDate(new Date('2020-01-01'))).toBe(true);
  });

  it('returns false for future dates', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(isPastDate(future)).toBe(false);
  });
});

// --- timeToMinutes ---
describe('timeToMinutes', () => {
  it('converts midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts simple times', () => {
    expect(timeToMinutes('09:00')).toBe(540);
    expect(timeToMinutes('12:30')).toBe(750);
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

// --- minutesToTime ---
describe('minutesToTime', () => {
  it('converts 0 to 00:00', () => {
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('converts minutes to time string', () => {
    expect(minutesToTime(540)).toBe('09:00');
    expect(minutesToTime(750)).toBe('12:30');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('pads single digits', () => {
    expect(minutesToTime(65)).toBe('01:05');
  });
});

// --- timeToMinutes + minutesToTime roundtrip ---
describe('time conversion roundtrip', () => {
  it('timeToMinutes and minutesToTime are inverse', () => {
    const times = ['00:00', '09:00', '12:30', '18:45', '23:59'];
    for (const time of times) {
      expect(minutesToTime(timeToMinutes(time))).toBe(time);
    }
  });
});

// --- calculateEndTime ---
describe('calculateEndTime', () => {
  it('adds duration to start time', () => {
    const start = new Date('2026-03-30T10:00:00');
    const end = calculateEndTime(start, 60);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(0);
  });

  it('adds duration + buffer', () => {
    const start = new Date('2026-03-30T10:00:00');
    const end = calculateEndTime(start, 60, 15);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(15);
  });

  it('does not mutate the original date', () => {
    const start = new Date('2026-03-30T10:00:00');
    const originalTime = start.getTime();
    calculateEndTime(start, 60);
    expect(start.getTime()).toBe(originalTime);
  });
});

// --- haversineDistance ---
describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('calculates Paris to Lyon (~392km)', () => {
    const dist = haversineDistance(48.8566, 2.3522, 45.7640, 4.8357);
    expect(dist).toBeGreaterThan(380);
    expect(dist).toBeLessThan(410);
  });

  it('calculates Paris to Bruxelles (~264km)', () => {
    const dist = haversineDistance(48.8566, 2.3522, 50.8503, 4.3517);
    expect(dist).toBeGreaterThan(250);
    expect(dist).toBeLessThan(280);
  });
});

// --- formatDistance ---
describe('formatDistance', () => {
  it('formats meters for < 1km', () => {
    expect(formatDistance(0.5)).toBe('500 m');
    expect(formatDistance(0.15)).toBe('150 m');
  });

  it('formats with 1 decimal for 1-10km', () => {
    expect(formatDistance(3.7)).toBe('3.7 km');
    expect(formatDistance(9.9)).toBe('9.9 km');
  });

  it('rounds for >= 10km', () => {
    expect(formatDistance(15.3)).toBe('15 km');
    expect(formatDistance(100.7)).toBe('101 km');
  });
});

// --- normalizeCity ---
describe('normalizeCity', () => {
  it('lowercases', () => {
    expect(normalizeCity('Paris')).toBe('paris');
  });

  it('removes accents', () => {
    expect(normalizeCity('Saint-Étienne')).toBe('saint-etienne');
    expect(normalizeCity('Évry-Courcouronnes')).toBe('evry-courcouronnes');
  });

  it('trims and collapses whitespace', () => {
    expect(normalizeCity('  Aix  en  Provence  ')).toBe('aix en provence');
  });
});

// --- capitalizeWords ---
describe('capitalizeWords', () => {
  it('capitalizes first letter of each word', () => {
    expect(capitalizeWords('paris')).toBe('Paris');
    expect(capitalizeWords('new york')).toBe('New York');
  });

  it('handles hyphens', () => {
    expect(capitalizeWords('saint-etienne')).toBe('Saint-Etienne');
  });

  it('handles apostrophes', () => {
    expect(capitalizeWords("l'isle-adam")).toBe("L'Isle-Adam");
  });

  it('returns empty for empty input', () => {
    expect(capitalizeWords('')).toBe('');
  });
});

// --- generateSearchTokens ---
describe('generateSearchTokens', () => {
  it('generates prefix tokens from business name', () => {
    const tokens = generateSearchTokens('Salon Hugo');
    expect(tokens).toContain('sal');
    expect(tokens).toContain('salo');
    expect(tokens).toContain('salon');
    expect(tokens).toContain('hug');
    expect(tokens).toContain('hugo');
  });

  it('removes accents', () => {
    const tokens = generateSearchTokens('Étoilé');
    expect(tokens).toContain('eto');
    expect(tokens).toContain('etoile');
  });

  it('ignores words shorter than 3 chars', () => {
    const tokens = generateSearchTokens('Le Spa De Lyon');
    expect(tokens).not.toContain('le');
    expect(tokens).not.toContain('de');
    expect(tokens).toContain('spa');
    expect(tokens).toContain('lyon');
  });

  it('removes special characters and joins around apostrophes', () => {
    const tokens = generateSearchTokens("L'Artisan & Co");
    // "L'Artisan" becomes "lartisan" (apostrophe removed, treated as one word)
    expect(tokens).toContain('lar');
    expect(tokens).toContain('lartisan');
  });

  it('returns unique tokens', () => {
    const tokens = generateSearchTokens('Test Test');
    const uniqueTokens = [...new Set(tokens)];
    expect(tokens.length).toBe(uniqueTokens.length);
  });
});
