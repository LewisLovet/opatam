'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe, X } from 'lucide-react';
import type { AppLocale } from '@booking-app/i18n';

/**
 * Surfaces actually translated to English — the card must never promise
 * "available in English" on a page that isn't (pro dashboard, admin, auth,
 * blog…). ALLOWLIST on purpose: a new page is excluded until its i18n phase
 * lands and it gets added here.
 */
const TRANSLATED_PREFIXES = ['/p/', '/reservation/', '/avis/'];
function isTranslatedSurface(pathname: string): boolean {
  if (pathname === '/') return true;
  return TRANSLATED_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Small card PROPOSING English when the browser prefers it — detection never
 * forces the locale (a French speaker with an English OS must never land on
 * an unwanted English page; see i18n/request.ts).
 *
 * Shows only when ALL of:
 *   - the page is currently French (default locale, no explicit choice yet),
 *   - no NEXT_LOCALE cookie exists (any value = the visitor already decided,
 *     via this card or the FR/EN switcher),
 *   - the browser's preferred languages include English.
 *
 * Both answers write the cookie, so the card never comes back: "View in
 * English" reloads in English; the ✕ / "Continuer en français" records
 * French as the explicit choice.
 *
 * The copy is deliberately hardcoded in English (with a French decline
 * button) rather than living in the dictionaries: its audience is by
 * definition English-speaking visitors on a French page.
 */
export function LanguageSuggestionBanner() {
  const locale = useLocale();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (locale !== 'fr') return; // already on a non-default locale
    // Only on public/client pages that ARE translated (never /pro, /admin,
    // /dev, /affiliation, auth routes… where the promise would be false).
    if (!isTranslatedSurface(pathname)) {
      setVisible(false);
      return;
    }
    // Never inside an iframe (embed widget on third-party sites): cross-site
    // cookies are unreliable there — the embed takes an explicit ?lang= param.
    if (window.self !== window.top) return;
    if (/(?:^|;\s*)NEXT_LOCALE=/.test(document.cookie)) return; // already chose
    const preferred =
      navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];
    const wantsEnglish = preferred.some((l) => l?.toLowerCase().startsWith('en'));
    // QA hook: ?lang-suggest=1 forces the card so it can be tested from a
    // French browser (it only ever shows a suggestion — harmless).
    const forced = new URLSearchParams(window.location.search).get('lang-suggest') === '1';
    if (wantsEnglish || forced) setVisible(true);
  }, [locale, pathname]);

  const choose = (next: AppLocale) => {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    setVisible(false);
    if (next !== locale) window.location.reload();
  };

  if (!visible) return null;

  return (
    <div className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-6 z-50 sm:max-w-sm animate-fade-in-up">
      <div
        role="dialog"
        aria-label="Language suggestion"
        className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
            <Globe className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              This page is also available in English
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => choose('en')}
                className="px-3.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                View in English
              </button>
              <button
                type="button"
                onClick={() => choose('fr')}
                className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
              >
                Continuer en français
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => choose('fr')}
            aria-label="Dismiss"
            className="p-1 -m-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
