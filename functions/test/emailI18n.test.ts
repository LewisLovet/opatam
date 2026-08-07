import { describe, it, expect } from 'vitest';
import { EMAIL_TEXTS, resolveEmailLocale, type EmailLocale } from '../src/utils/emailI18n';

/**
 * Les langues servies par les e-mails clients. Le français est la langue de
 * repli, les autres sont testées contre lui.
 *
 * Ajouter une langue ici suffit à étendre TOUTE la parité structurelle : sans
 * ça, une langue peut être branchée dans le code sans qu'aucun test ne
 * regarde ses gabarits (c'est ce qui s'est passé pour l'italien, le portugais
 * puis l'allemand — le fichier ne comparait que fr/en).
 */
const TRANSLATED_LOCALES: EmailLocale[] = ['en', 'it', 'pt', 'de'];

describe('resolveEmailLocale', () => {
  it("returns 'fr' for 'fr'", () => {
    expect(resolveEmailLocale('fr')).toBe('fr');
  });

  for (const locale of TRANSLATED_LOCALES) {
    it(`returns '${locale}' for '${locale}'`, () => {
      expect(resolveEmailLocale(locale)).toBe(locale);
    });
  }

  it("falls back to 'fr' for null", () => {
    expect(resolveEmailLocale(null)).toBe('fr');
  });

  it("falls back to 'fr' for undefined", () => {
    expect(resolveEmailLocale(undefined)).toBe('fr');
  });

  it("falls back to 'fr' for an unsupported locale ('es')", () => {
    expect(resolveEmailLocale('es')).toBe('fr');
  });

  it("falls back to 'fr' for an empty string", () => {
    expect(resolveEmailLocale('')).toBe('fr');
  });

  it("is strict about casing ('EN' → 'fr')", () => {
    expect(resolveEmailLocale('EN')).toBe('fr');
  });

  it("is strict about regional tags ('de-DE' → 'fr')", () => {
    // `booking.clientLocale` ne stocke que le code court : un tag régional
    // signale une écriture d'une autre provenance, à ne pas interpréter.
    expect(resolveEmailLocale('de-DE')).toBe('fr');
  });
});

describe('EMAIL_TEXTS structural parity across locales', () => {
  /**
   * Walk a texts subtree and flatten every leaf into "path [kind]" strings.
   * A leaf is either a string or an interpolation function; for functions we
   * also record the arity so every variant must accept the same arguments.
   * Comparing the flattened lists between French and a translation guarantees
   * the two locales expose exactly the same keys, recursively.
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
      [
        'cancellation',
        'common',
        'confirmation',
        'depositReminder',
        'loyalty',
        'reminder',
        'reschedule',
        'review',
      ].sort(),
    );
  });

  for (const section of sections) {
    for (const locale of TRANSLATED_LOCALES) {
      it(`section '${String(section)}' — '${locale}' matches the French key tree`, () => {
        const entry = EMAIL_TEXTS[section] as Record<EmailLocale, unknown>;
        expect(entry.fr).toBeDefined();
        expect(entry[locale]).toBeDefined();

        const frPaths = leafPaths(entry.fr);
        expect(frPaths.length).toBeGreaterThan(0);
        expect(leafPaths(entry[locale])).toEqual(frPaths);
      });
    }
  }
});
