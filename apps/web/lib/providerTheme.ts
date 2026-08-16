import { getProviderTheme } from '@booking-app/shared';

/** Les onze crans, dans l'ordre du tableau `ramp`. */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Déclarations `--color-primary-*` d'un thème, prêtes à poser dans un bloc CSS.
 *
 * Extrait en fonction pure parce que DEUX mécanismes s'en servent : la balise
 * <style> de la page publique, et l'embed — qui possède depuis plus longtemps
 * son propre sélecteur libre `?primaryColor=#hex`. Les deux doivent produire
 * exactement la même chose, sans quoi une vitrine et son widget affichent deux
 * couleurs différentes pour un même salon.
 */
export function providerThemeVars(themeId?: string | null): string {
  const theme = getProviderTheme(themeId);
  return STEPS.map((s, i) => `--color-primary-${s}:${theme.ramp[i]}`).join(';');
}

/**
 * Déclarations à appliquer EN PLUS en mode sombre, ou `null` si la gamme n'en
 * demande pas. Une seule des vingt-quatre est concernée : le Noir, dont
 * l'aplat se confond avec le fond de page.
 */
export function providerThemeDarkVars(themeId?: string | null): string | null {
  const theme = getProviderTheme(themeId);
  if (!theme.rampDark) return null;
  return Object.entries(theme.rampDark)
    .map(([s, v]) => `--color-primary-${s}:${v}`)
    .join(';');
}
