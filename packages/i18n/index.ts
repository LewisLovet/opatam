/**
 * Shared translation dictionaries — ONE source of truth for every surface
 * (web, mobile, functions). One JSON file per locale, organised by namespace
 * ("home", "common", "booking"…). Adding a language = adding a JSON file here
 * and listing it in LOCALES — no screen code changes.
 */

import fr from './messages/fr.json';
import en from './messages/en.json';

export const LOCALES = ['fr', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'fr';

export const MESSAGES: Record<AppLocale, Record<string, unknown>> = { fr, en };

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
