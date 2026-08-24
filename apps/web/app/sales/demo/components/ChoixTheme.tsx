'use client';

import { Check } from 'lucide-react';
import { PROVIDER_THEMES } from '@booking-app/shared';
import { themeDepuisCouleur, nomDuTheme } from '@/lib/sales-demo-theme';

/**
 * Le thème se choisit en VOYANT les couleurs — une grille de pastilles,
 * pas un <select> de noms. La première case est l'automatique : la couleur
 * relevée sur le document du prospect, affichée pour que le commercial
 * sache ce que « automatique » donnera.
 */
export function ChoixTheme({
  valeur,
  brandColor,
  onChange,
}: {
  /** '' = automatique. */
  valeur: string;
  brandColor?: string | null;
  onChange: (themeId: string) => void;
}) {
  const themeAuto = brandColor ? themeDepuisCouleur(brandColor) : null;
  const rampe = (id: string) => PROVIDER_THEMES.find((t) => t.id === id)?.ramp[5] ?? '120 120 120';

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {/* Automatique */}
        <button
          type="button"
          onClick={() => onChange('')}
          title={themeAuto ? `Automatique — ${nomDuTheme(themeAuto)}` : 'Automatique'}
          className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            valeur === ''
              ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400'
          }`}
        >
          <span
            className="w-4 h-4 rounded-full border border-black/10"
            style={{
              background: themeAuto
                ? `rgb(${rampe(themeAuto)})`
                : 'conic-gradient(#f43f6e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f6e)',
            }}
          />
          Auto{themeAuto ? ` · ${nomDuTheme(themeAuto)}` : ''}
        </button>

        {PROVIDER_THEMES.map((t) => {
          const actif = valeur === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              title={t.label}
              className={`relative w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 ${
                actif ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-gray-900' : ''
              }`}
              style={{ background: `rgb(${t.ramp[5]})` }}
            >
              {actif && <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        {valeur === ''
          ? brandColor
            ? `La couleur relevée sur le document (${brandColor}) choisit la gamme automatiquement.`
            : 'Sans couleur relevée, la démo garde la gamme par défaut.'
          : `Gamme « ${nomDuTheme(valeur)} » — remplace la couleur automatique.`}
      </p>
    </div>
  );
}
