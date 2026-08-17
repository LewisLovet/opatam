'use client';

import { providerThemeVars, providerThemeDarkVars } from '@/lib/providerTheme';

/**
 * Aperçu compact d'une gamme, sur les éléments qui la portent réellement.
 *
 * Les pastilles du sélecteur montrent la gamme, pas le résultat : un
 * professionnel qui choisit « Or » ne sait pas à quoi ressemblera son bouton.
 * D'où cet aperçu, qui reprend exactement les composants de la vitrine —
 * bouton d'action, pastille de promotion, prix, encart de disponibilité,
 * lien et notation.
 *
 * Rendu dans le thème COURANT de la page (clair ou sombre), pas les deux
 * côte à côte : dans un formulaire, la place manque et la comparaison n'est
 * pas ce que cherche le professionnel — il veut voir sa couleur.
 *
 * La portée passe par `data-theme-preview` et non `data-provider-theme` : ce
 * dernier est celui des vraies surfaces publiques, et les confondre ferait
 * repeindre une page entière depuis un simple aperçu. Un seul aperçu par
 * page — deux se marcheraient dessus, la règle étant globale.
 */
export function ThemePreview({ themeId }: { themeId?: string | null }) {
  const dark = providerThemeDarkVars(themeId);
  const css =
    `[data-theme-preview]{${providerThemeVars(themeId)}}` +
    (dark
      ? `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) [data-theme-preview]{${dark}}}` +
        `:root[data-theme="dark"] [data-theme-preview]{${dark}}`
      : '');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        data-theme-preview
        className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap items-center gap-3"
      >
        <span className="rounded-lg bg-primary-600 px-4 py-2 text-white text-sm font-semibold">
          Réserver
        </span>
        <span className="rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:text-primary-300">
          −20 %
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
          45,00 €
        </span>
        <span className="text-primary-600 dark:text-primary-400 text-base tracking-wide">
          ★★★★★
        </span>
        <span className="text-primary-700 dark:text-primary-400 text-sm underline underline-offset-4">
          Voir les prestations
        </span>
      </div>
    </>
  );
}
