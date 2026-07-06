import { describe, it, expect } from 'vitest';
import { EMAIL_TEXTS, resolveEmailLocale } from '../src/utils/emailI18n';

describe('resolveEmailLocale', () => {
  it("returns 'fr' for 'fr'", () => {
    expect(resolveEmailLocale('fr')).toBe('fr');
  });

  it("returns 'en' for 'en'", () => {
    expect(resolveEmailLocale('en')).toBe('en');
  });

  it("falls back to 'fr' for null", () => {
    expect(resolveEmailLocale(null)).toBe('fr');
  });

  it("falls back to 'fr' for undefined", () => {
    expect(resolveEmailLocale(undefined)).toBe('fr');
  });

  it("falls back to 'fr' for an unsupported locale ('de')", () => {
    expect(resolveEmailLocale('de')).toBe('fr');
  });

  it("falls back to 'fr' for an empty string", () => {
    expect(resolveEmailLocale('')).toBe('fr');
  });

  it("is strict about casing ('EN' → 'fr')", () => {
    expect(resolveEmailLocale('EN')).toBe('fr');
  });
});

describe('EMAIL_TEXTS fr/en structural parity', () => {
  /**
   * Walk a texts subtree and flatten every leaf into "path [kind]" strings.
   * A leaf is either a string or an interpolation function; for functions we
   * also record the arity so fr/en variants must accept the same arguments.
   * Comparing the flattened lists between fr and en guarantees the two
   * locales expose exactly the same keys, recursively.
   */
  function leafPaths(node: unknown, prefix = ''): string[] {
    if (typeof node === 'function') {
      return [`${prefix} [fn/${node.length}]`];
    }
    if (typeof node === 'string') {
      return [`${prefix} [string]`];
    }
    if (node !== null && typeof node === 'object') {
      return Object.keys(node as Record<string, unknown>)
        .sort()
        .flatMap((key) =>
          leafPaths((node as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key),
        );
    }
    return [`${prefix} [${typeof node}]`];
  }

  const sections = Object.keys(EMAIL_TEXTS) as (keyof typeof EMAIL_TEXTS)[];

  it('covers every email of the client scope', () => {
    expect(sections.sort()).toEqual(
      ['cancellation', 'common', 'confirmation', 'depositReminder', 'reminder', 'reschedule', 'review'].sort(),
    );
  });

  for (const section of sections) {
    it(`section '${String(section)}' has both locales with identical key trees`, () => {
      const entry = EMAIL_TEXTS[section] as { fr: unknown; en: unknown };
      expect(entry.fr).toBeDefined();
      expect(entry.en).toBeDefined();

      const frPaths = leafPaths(entry.fr);
      const enPaths = leafPaths(entry.en);
      expect(frPaths.length).toBeGreaterThan(0);
      expect(enPaths).toEqual(frPaths);
    });
  }
});
