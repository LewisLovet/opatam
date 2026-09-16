/**
 * Hauteur annoncée au site hôte par la page embarquée.
 *
 * Le bug corrigé (rapport d'un intégrateur, 2026-09-16) : `document.scrollHeight`
 * ne descend jamais sous la hauteur de la fenêtre — donc, dans une iframe déjà
 * agrandie par le site hôte, jamais sous la hauteur précédente. L'agenda
 * grandissait à chaque étape et ne rétrécissait plus : 500 px de vide sous
 * le pied de page à l'étape « Vos informations ».
 *
 * On mesure donc le CONTENU (le conteneur `#opatam-embed-root`), pas le
 * document. Repli sur `scrollHeight` si le conteneur n'est pas monté.
 */

export const EMBED_ROOT_ID = 'opatam-embed-root';

export function mesurerHauteurEmbed(): number {
  if (typeof document === 'undefined') return 0;
  const root = document.getElementById(EMBED_ROOT_ID);
  if (root) {
    // offsetTop : ce qui précède le conteneur (rien aujourd'hui, mais un
    // bandeau ajouté demain compterait) ; +1 : jamais de barre de défilement
    // pour un demi-pixel d'arrondi.
    return Math.ceil(root.offsetTop + root.getBoundingClientRect().height) + 1;
  }
  return document.documentElement.scrollHeight;
}

/** Envoie la hauteur au site hôte. Silencieux hors iframe ou si refusé. */
export function annoncerHauteurEmbed(): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  const height = mesurerHauteurEmbed();
  if (height <= 0) return;
  try {
    window.parent.postMessage({ type: 'opatam-embed-height', height }, '*');
  } catch {
    // Hôte inter-origine qui refuse : sans conséquence.
  }
}
