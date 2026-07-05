'use client';

import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { LOCALES, type AppLocale } from '@booking-app/i18n';

const LABELS: Record<AppLocale, string> = { fr: 'FR', en: 'EN' };

/**
 * FR/EN pill switcher. Stores the explicit choice in the `NEXT_LOCALE`
 * cookie (read by i18n/request.ts) and reloads so every server component
 * re-renders in the new language. Cookie choice beats browser detection.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();

  const switchTo = (next: AppLocale) => {
    if (next === locale) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
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
