'use client';

import { useState } from 'react';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { ThemePreview } from '@/components/theme/ThemePreview';
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
          <div className="lg:sticky lg:top-10 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Aperçu</p>
            <ThemePreview themeId={themeId} />
          </div>
        </div>
      </div>
    </div>
  );
}
