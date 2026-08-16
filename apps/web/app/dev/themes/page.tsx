'use client';

import { useState } from 'react';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { providerThemeVars } from '@/lib/providerTheme';
import { getProviderTheme } from '@booking-app/shared';

/**
 * Prévisualisation du sélecteur de thème, hors authentification.
 *
 * L'écran réel vit dans l'espace pro, derrière une connexion. Cette page
 * existe pour juger le composant et l'effet d'une gamme sans avoir à ouvrir
 * une session — utile en revue, et suffisant pour valider le rendu.
 *
 * Sous /dev, donc interdite d'indexation par robots.txt.
 */
export default function DevThemesPage() {
  const [themeId, setThemeId] = useState('terracotta');
  const theme = getProviderTheme(themeId);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6 sm:p-10">
      <style dangerouslySetInnerHTML={{ __html: `[data-provider-theme]{${providerThemeVars(themeId)}}` }} />

      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Sélecteur de thème
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Prévisualisation hors authentification · gamme active :{' '}
          <span className="font-medium text-gray-900 dark:text-white">{theme.label}</span>
        </p>

        <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-start">
          <ThemePicker value={themeId} onChange={setThemeId} />

          {/* L'aperçu porte l'attribut de portée : il reçoit la gamme comme
              le ferait la vitrine publique. */}
          <div
            data-provider-theme
            className="rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4 lg:sticky lg:top-10"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Aperçu
            </p>

            <button className="w-full rounded-xl bg-primary-600 px-4 py-3 text-white font-semibold">
              Réserver
            </button>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">
                −20 %
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                45,00 €
              </span>
            </div>

            <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 px-3 py-2.5">
              <p className="text-sm text-primary-700 dark:text-primary-300">
                Prochaine disponibilité : aujourd&apos;hui
              </p>
            </div>

            <p className="text-primary-600 dark:text-primary-400 text-sm underline underline-offset-4">
              Voir les prestations
            </p>

            <div className="flex gap-1 text-primary-600 dark:text-primary-400 text-lg">
              ★★★★★
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
