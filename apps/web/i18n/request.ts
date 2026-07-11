import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, MESSAGES, isAppLocale } from '@booking-app/i18n';

/**
 * Locale resolution:
 *   1. `x-app-locale` header — set by middleware.ts for the `/en/...` routes
 *      (URL wins: an indexable English URL must render English for every
 *      visitor and crawler, cookie or not).
 *   2. `NEXT_LOCALE` cookie (set by the FR/EN switcher or the suggestion
 *      card — always a deliberate user action).
 *   3. French (default).
 *
 * Browser detection (Accept-Language) deliberately does NOT force the
 * locale: a French speaker with an English browser must never land on an
 * unwanted English page. Instead, <LanguageSuggestionBanner> (root layout)
 * shows a small card PROPOSING English when the browser prefers it — the
 * visitor decides, and either answer is stored in the cookie so we never
 * ask twice.
 */
export default getRequestConfig(async () => {
  const headerStore = await headers();
  const fromUrl = headerStore.get('x-app-locale');

  let locale = isAppLocale(fromUrl) ? fromUrl : undefined;

  if (!locale) {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;
    locale = isAppLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: MESSAGES[locale] as never,
  };
});
