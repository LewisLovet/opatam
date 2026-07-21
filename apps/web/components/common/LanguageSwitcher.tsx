'use client';

import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { LOCALES, type AppLocale } from '@booking-app/i18n';
import { localizedPath, isTranslatedSurface } from '@/lib/localizedPath';

const LABELS: Record<AppLocale, string> = { fr: 'FR', en: 'EN', it: 'IT' };

/**
 * FR/EN pill switcher. Stores the explicit choice in the `NEXT_LOCALE`
 * cookie (read by i18n/request.ts), then NAVIGATES to the same page in the
 * target language: on surfaces with an English URL (/en/...), switching
 * changes the URL — the language lives in the address, shareable and
 * indexable. Elsewhere the cookie alone drives it (plain reload).
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();

  const switchTo = (next: AppLocale) => {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (isTranslatedSurface(window.location.pathname)) {
      window.location.assign(localizedPath(here, next));
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-1.5 py-1 ${className}`}
      role="group"
      aria-label="Langue / Language"
    >
      <Globe className="w-3.5 h-3.5 text-gray-400 ml-1" aria-hidden="true" />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={l === locale}
          className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
            l === locale
              ? 'bg-primary-600 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
