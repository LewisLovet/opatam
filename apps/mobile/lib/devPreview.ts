/**
 * Aperçus DEV — forcer l'affichage d'éléments qui ne se déclenchent qu'à des
 * conditions rares.
 *
 * Le bandeau d'incitation à la story n'apparaît qu'au professionnel dont la
 * page est peu vue et qui n'a jamais partagé. Un compte de démonstration
 * actif ne remplit aucune des deux conditions : il n'y avait donc AUCUN moyen
 * de regarder ce bandeau sur un vrai écran, ni de juger sa mise en page.
 *
 * Même principe que `previewOtaSplash` : un interrupteur en mémoire, lu par
 * le composant, réservé à `__DEV__`. Rien n'est écrit sur l'appareil et rien
 * ne franchit la frontière de la production — la lecture est gardée par
 * `__DEV__` des deux côtés.
 */

type Ecouteur = () => void;

const ecouteurs = new Set<Ecouteur>();
let forcerBandeauStory = false;

/** L'état courant. Toujours `false` hors développement. */
export function isStoryNudgeForced(): boolean {
  return __DEV__ && forcerBandeauStory;
}

/** Bascule l'aperçu et prévient les composants abonnés. */
export function toggleStoryNudgePreview(): boolean {
  if (!__DEV__) return false;
  forcerBandeauStory = !forcerBandeauStory;
  ecouteurs.forEach((f) => f());
  return forcerBandeauStory;
}

/** S'abonner aux changements. Renvoie la fonction de désabonnement. */
export function subscribeDevPreview(f: Ecouteur): () => void {
  ecouteurs.add(f);
  return () => {
    ecouteurs.delete(f);
  };
}
