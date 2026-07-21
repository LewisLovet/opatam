/**
 * Shared translation dictionaries — ONE source of truth for every surface
 * (web, mobile, functions). One JSON file per locale, organised by namespace
 * ("home", "common", "booking"…). Adding a language = adding a JSON file here
 * and listing it in LOCALES — no screen code changes.
 */

import fr from './messages/fr.json';
import en from './messages/en.json';
// Per-domain files — one pair per rollout phase so parallel extraction work
// never collides on the same JSON. Each file IS its namespace subtree.
import frProvider from './messages/fr-provider.json';
import enProvider from './messages/en-provider.json';
import frBooking from './messages/fr-booking.json';
import enBooking from './messages/en-booking.json';
import it from './messages/it.json';
import itProvider from './messages/it-provider.json';
import itBooking from './messages/it-booking.json';

export const LOCALES = ['fr', 'en', 'it'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'fr';

export const MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  fr: { ...fr, provider: frProvider, booking: frBooking },
  en: { ...en, provider: enProvider, booking: enBooking },
  it: { ...it, provider: itProvider, booking: itBooking },
};

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
