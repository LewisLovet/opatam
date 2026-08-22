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

describe("régression : l'heure du rendez-vous ne doit jamais disparaître", () => {
  // Reproduit `formatDateProvider` — une version antérieure s'arrêtait au
  // mois, et les push de réservation, annulation et modification perdaient
  // l'horaire, c'est-à-dire l'information la plus utile au prestataire.
  const formatte = (d: Date, intl: string, tz: string) =>
    d.toLocaleString(intl, {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    });

  const rdv = new Date('2026-08-22T12:30:00Z'); // 14 h 30 à Paris, 13 h 30 à Lisbonne

  it('français : jour, mois ET heure', () => {
    expect(formatte(rdv, 'fr-FR', 'Europe/Paris').includes('14:30')).toBe(true);
  });
  it("portugais : l'heure est celle de Lisbonne", () => {
    const out = formatte(rdv, 'pt-PT', 'Europe/Lisbon');
    expect(out.includes('13:30')).toBe(true);
    expect(out.includes('14:30')).toBe(false);
  });
  it('les cinq langues portent toutes une heure', () => {
    for (const [intl, tz] of [['fr-FR','Europe/Paris'],['en-GB','Europe/Paris'],['it-IT','Europe/Rome'],['pt-PT','Europe/Lisbon'],['de-DE','Europe/Berlin']]) {
      expect(/\d{1,2}[:h]\d{2}/.test(formatte(rdv, intl, tz))).toBe(true);
    }
  });
});
