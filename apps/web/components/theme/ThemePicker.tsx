'use client';

import { PROVIDER_THEMES, THEME_FAMILIES, DEFAULT_THEME_ID } from '@booking-app/shared';

/**
 * Sélecteur de gamme pour la vitrine d'un professionnel.
 *
 * Une liste fermée, pas une roue chromatique : sur onze nuances dérivées d'une
 * couleur libre, le contraste n'est plus garanti — ni sur fond clair, ni sur
 * fond sombre. Chaque gamme ici a été dessinée et éprouvée sur les deux.
 *
 * Les pastilles montrent trois nuances (100 / 400 / 600) et non une seule : ce
 * qui distingue « Terracotta » de « Cuivre » n'est pas leur couleur de bouton,
 * c'est la façon dont leur gamme s'éclaircit.
 */
export function ThemePicker({
  value,
  onChange,
  disabled,
}: {
  value?: string | null;
  onChange: (themeId: string) => void;
  disabled?: boolean;
}) {
  const selected = value || DEFAULT_THEME_ID;

  return (
    <div className="space-y-5">
      {THEME_FAMILIES.map((famille) => {
        const gammes = PROVIDER_THEMES.filter((t) => t.family === famille.id);
        if (gammes.length === 0) return null;

        return (
          <div key={famille.id}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              {famille.label}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gammes.map((t) => {
                const actif = t.id === selected;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(t.id)}
                    aria-pressed={actif}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                      actif
                        ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className="flex shrink-0 rounded-md overflow-hidden border border-black/10 dark:border-white/10">
                      {[1, 4, 6].map((i) => (
                        <span
                          key={i}
                          className="w-3 h-7"
                          style={{ background: `rgb(${t.ramp[i]})` }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
                        {t.label}
                      </span>
                      {t.id === DEFAULT_THEME_ID && (
                        <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                          par défaut
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
