/**
 * La meilleure affiche disponible pour une vidéo YouTube.
 *
 * YouTube publie plusieurs tailles, mais pas pour toutes les vidéos :
 * `maxresdefault` (1280 × 720) et `sddefault` (640 × 480) manquent souvent.
 * Le piège : une taille absente ne répond PAS 404, elle renvoie une image
 * de remplacement grise de 120 × 90. Un simple `onError` ne détecte donc
 * rien ; il faut charger l'image et regarder sa largeur réelle.
 *
 * Du plus net au plus sûr : maxres → sd → hq (480 × 360, toujours là).
 * Côté navigateur uniquement — sur le serveur, on rend `hqdefault`.
 */

const TAILLES = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

export function affichesYoutube(id: string): string[] {
  return TAILLES.map((t) => `https://i.ytimg.com/vi/${id}/${t}.jpg`);
}

/** Largeur en dessous de laquelle YouTube a servi son image de remplacement. */
const LARGEUR_REMPLACEMENT = 121;

function largeurReelle(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(0);
    img.src = url;
  });
}

export async function meilleureAfficheYoutube(id: string): Promise<string> {
  const candidates = affichesYoutube(id);
  for (const url of candidates.slice(0, -1)) {
    const largeur = await largeurReelle(url);
    if (largeur >= LARGEUR_REMPLACEMENT) return url;
  }
  return candidates[candidates.length - 1];
}
