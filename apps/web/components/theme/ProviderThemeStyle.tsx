import { getProviderTheme } from '@booking-app/shared';

/** Les onze crans, dans l'ordre du tableau `ramp`. */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Redéfinit les jetons `--color-primary-*` pour un prestataire donné.
 *
 * POURQUOI UNE BALISE <style> ET NON UN style={{}} SUR UN DIV :
 * les surfaces publiques utilisent 107 classes `bg/text/border-primary-*`, et
 * certaines vivent dans des portails (modales, tiroirs) rendus hors de l'arbre
 * du composant. Un style en ligne sur un conteneur ne les atteindrait pas.
 * L'attribut `data-provider-theme` sert de portée : tout ce qui est à
 * l'intérieur hérite, l'habillage Opatam autour garde ses couleurs.
 *
 * POURQUOI LE MODE SOMBRE EST TRAITÉ À PART :
 * une gamme presque noire — le thème « Noir » — produit un aplat qui se
 * confond avec le fond de page en sombre. On ne l'inverse PAS (un salon qui
 * choisit le noir doit garder un bouton noir) : les nuances porteuses
 * remontent de deux crans, ce que `rampDark` décrit gamme par gamme. Les
 * trois sélecteurs reprennent le contrat de globals.css : préférence système,
 * choix explicite « clair » qui doit gagner sur un OS sombre, choix explicite
 * « sombre » qui doit gagner sur un OS clair.
 */
export function ProviderThemeStyle({ themeId }: { themeId?: string | null }) {
  const theme = getProviderTheme(themeId);

  const base = STEPS.map((s, i) => `--color-primary-${s}:${theme.ramp[i]}`).join(';');

  const dark = theme.rampDark
    ? Object.entries(theme.rampDark)
        .map(([s, v]) => `--color-primary-${s}:${v}`)
        .join(';')
    : null;

  const css =
    `[data-provider-theme]{${base}}` +
    (dark
      ? `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) [data-provider-theme]{${dark}}}` +
        `:root[data-theme="dark"] [data-provider-theme]{${dark}}`
      : '');

  // Le thème fait partie du rendu serveur : injecté côté client, la page
  // s'afficherait une fraction de seconde en bleu avant de virer — visible,
  // et pire sur une connexion lente.
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
