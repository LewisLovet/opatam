import { PROVIDER_THEMES, DEFAULT_THEME_ID } from '@booking-app/shared';

/**
 * Couleur de marque du prospect → thème Opatam le plus proche.
 *
 * L'IA relève la couleur dominante du document (« brandColor », hex) ; ici on
 * la projette sur le catalogue de thèmes. La comparaison se fait en TSL sur la
 * nuance 500 de chaque gamme — celle qui porte les boutons et les accents,
 * donc celle que le prospect reconnaîtra comme « sa » couleur.
 *
 * Deux régimes, parce que la teinte d'un gris n'a aucun sens :
 * - couleur peu saturée → on ne compare qu'aux gammes neutres, sur la
 *   luminosité (un menu noir sur crème doit donner « noir », pas la gamme
 *   colorée dont le gris se rapprocherait par accident) ;
 * - couleur franche → distance pondérée où la TEINTE domine : un violet doit
 *   tomber sur un violet même plus clair, jamais sur un bleu de même clarté.
 */

interface Hsl {
  h: number; // 0–360
  s: number; // 0–1
  l: number; // 0–1
}

function hexVersHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return rgbVersHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function rgbVersHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** La nuance 500 d'une gamme (« 69 69 69 ») en TSL. */
function nuance500(ramp: readonly string[]): Hsl {
  const [r, g, b] = ramp[5].split(' ').map(Number);
  return rgbVersHsl(r, g, b);
}

function ecartTeinte(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function themeDepuisCouleur(hex: string): string {
  const cible = hexVersHsl(hex);
  if (!cible) return DEFAULT_THEME_ID;

  // Gris, noir, blanc cassé : le choix se joue sur la luminosité, parmi les
  // neutres uniquement.
  if (cible.s < 0.14) {
    let meilleur = DEFAULT_THEME_ID;
    let plusPetit = Infinity;
    for (const t of PROVIDER_THEMES) {
      if (t.family !== 'neutral') continue;
      const n = nuance500(t.ramp);
      const d = Math.abs(n.l - cible.l) + n.s * 0.5; // pénalise les neutres teintés
      if (d < plusPetit) { plusPetit = d; meilleur = t.id; }
    }
    return meilleur;
  }

  let meilleur = DEFAULT_THEME_ID;
  let plusPetit = Infinity;
  for (const t of PROVIDER_THEMES) {
    if (t.family === 'neutral') continue; // une couleur franche ne devient pas un gris
    const n = nuance500(t.ramp);
    const d =
      (ecartTeinte(n.h, cible.h) / 180) * 3 + // la teinte pèse trois fois plus
      Math.abs(n.s - cible.s) +
      Math.abs(n.l - cible.l);
    if (d < plusPetit) { plusPetit = d; meilleur = t.id; }
  }
  return meilleur;
}

/** Nom montré au commercial pour le thème retenu. */
export function nomDuTheme(themeId: string): string {
  return PROVIDER_THEMES.find((t) => t.id === themeId)?.label ?? themeId;
}
