import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, MESSAGES, isAppLocale } from '@booking-app/i18n';

/**
 * Locale resolution for the PILOT phase — no URL prefix yet:
 *   1. `NEXT_LOCALE` cookie (set by the language switcher — explicit choice)
 *   2. `Accept-Language` header (browser preference)
 *   3. French (default)
 *
 * When the public pages get their SEO rollout, URL-based routing
 * (`/en/...` via the [locale] segment) will take precedence over this —
 * cookie/header stay as fallbacks for non-prefixed routes.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;

  let locale = isAppLocale(fromCookie) ? fromCookie : undefined;

  if (!locale) {
    const acceptLanguage = (await headers()).get('accept-language') ?? '';
    // First language tag wins (e.g. "en-US,en;q=0.9,fr;q=0.8" → "en").
    const primary = acceptLanguage.split(',')[0]?.trim().slice(0, 2).toLowerCase();
    locale = isAppLocale(primary) ? primary : DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: MESSAGES[locale] as never,
  };
});
