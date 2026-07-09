import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, MESSAGES, isAppLocale } from '@booking-app/i18n';

/**
 * Locale resolution — EXPLICIT CHOICE ONLY:
 *   1. `NEXT_LOCALE` cookie (set by the FR/EN switcher or the suggestion
 *      card — always a deliberate user action)
 *   2. French (default)
 *
 * Browser detection (Accept-Language) deliberately does NOT force the
 * locale: a French speaker with an English browser must never land on an
 * unwanted English page. Instead, <LanguageSuggestionBanner> (root layout)
 * shows a small card PROPOSING English when the browser prefers it — the
 * visitor decides, and either answer is stored in the cookie so we never
 * ask twice.
 *
 * When the public pages get their SEO rollout, URL-based routing
 * (`/en/...` via the [locale] segment) will take precedence over this.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('NEXT_LOCALE')?.value;

  const locale = isAppLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;

  return {
    locale,
    messages: MESSAGES[locale] as never,
  };
});
