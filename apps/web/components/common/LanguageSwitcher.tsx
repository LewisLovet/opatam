'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LOCALES, type AppLocale } from '@booking-app/i18n';
import { localizedPath, isTranslatedSurface } from '@/lib/localizedPath';

/** Code court (déclencheur) et nom natif (menu) — universels, pas de clé i18n. */
const SHORT: Record<AppLocale, string> = { fr: 'FR', en: 'EN', it: 'IT', pt: 'PT' };
const NATIVE: Record<AppLocale, string> = {
  fr: 'Français',
  en: 'English',
  it: 'Italiano',
  pt: 'Português',
};

/**
 * Sélecteur de langue : un bouton compact (globe + langue courante) qui
 * ouvre la liste. À partir de 3-4 langues, aligner toutes les pastilles
 * mangeait la largeur du header — le menu garde une empreinte constante
 * quel que soit le nombre de langues.
 *
 * Le choix est stocké dans le cookie `NEXT_LOCALE` (lu par i18n/request.ts),
 * puis on NAVIGUE vers la même page dans la langue cible : sur les surfaces
 * qui ont une URL localisée (/en/…), la langue vit dans l'adresse —
 * partageable et indexable. Ailleurs, le cookie seul pilote (simple reload).
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur et à Échap (le menu flotte au-dessus du
  // contenu : sans ça il resterait ouvert en naviguant à la souris).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const switchTo = (next: AppLocale) => {
    setOpen(false);
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
    <div ref={boxRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Langue / Language"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur pl-2.5 pr-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <Globe className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
        {SHORT[locale] ?? SHORT.fr}
        <ChevronDown
          className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 min-w-[10rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl py-1 overflow-hidden"
        >
          {LOCALES.map((l) => {
            const active = l === locale;
            return (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => switchTo(l)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {NATIVE[l]}
                  {active && <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
