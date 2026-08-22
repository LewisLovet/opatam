import { describe, it, expect } from 'vitest';
import { providerLocale, PUSH_TEXTS, INTL_LOCALE } from './providerPushI18n';

describe('providerLocale — la langue du prestataire, pas celle de la cliente', () => {
  it('Portugal → portugais', () => expect(providerLocale({ countryCode: 'PT' })).toBe('pt'));
  it('Allemagne → allemand', () => expect(providerLocale({ countryCode: 'DE' })).toBe('de'));
  it('Italie → italien', () => expect(providerLocale({ countryCode: 'IT' })).toBe('it'));
  it('France, Belgique, Suisse, Luxembourg → français', () => {
    for (const c of ['FR', 'BE', 'CH', 'LU']) expect(providerLocale({ countryCode: c })).toBe('fr');
  });
  it("Espagne et Pays-Bas → anglais (ces langues ne sont pas servies)", () => {
    expect(providerLocale({ countryCode: 'ES' })).toBe('en');
    expect(providerLocale({ countryCode: 'NL' })).toBe('en');
  });
  it('pays absent ou inconnu → français', () => {
    expect(providerLocale({})).toBe('fr');
    expect(providerLocale({ countryCode: 'XX' })).toBe('fr');
  });
  it("une préférence explicite prime sur le pays", () => {
    expect(providerLocale({ countryCode: 'PT', locale: 'fr' })).toBe('fr');
  });
  it("une préférence non servie est ignorée au profit du pays", () => {
    expect(providerLocale({ countryCode: 'PT', locale: 'es' })).toBe('pt');
  });
});

describe('PUSH_TEXTS — les cinq langues sont complètes et distinctes', () => {
  const langues = ['fr', 'en', 'it', 'pt', 'de'] as const;

  it('chaque langue a toutes les clés', () => {
    const clesFr = Object.keys(PUSH_TEXTS.fr).sort().join(',');
    for (const l of langues) expect(Object.keys(PUSH_TEXTS[l]).sort().join(',')).toBe(clesFr);
  });

  it('le résumé du matin est bien traduit, pas recopié du français', () => {
    const fr = PUSH_TEXTS.fr.journeePlusieurs(3, '09:30');
    for (const l of langues.filter((x) => x !== 'fr')) {
      expect(PUSH_TEXTS[l].journeePlusieurs(3, '09:30') === fr).toBe(false);
    }
    expect(PUSH_TEXTS.pt.journeePlusieurs(3, '09:30')).toBe('Tem 3 marcações. A primeira começa às 09:30.');
    expect(PUSH_TEXTS.de.journeeUn('08:00')).toBe('Sie haben 1 Termin, um 08:00.');
  });

  it('chaque langue a son étiquette Intl', () => {
    expect(INTL_LOCALE.pt).toBe('pt-PT');
    expect(INTL_LOCALE.de).toBe('de-DE');
  });
});
