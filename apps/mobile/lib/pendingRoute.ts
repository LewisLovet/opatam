/**
 * Destination en attente de connexion.
 *
 * Un écran de l'espace client peut être atteint sans compte (bouton dans un
 * email ouvert dans le navigateur, navigation interne après expiration de
 * session). Plutôt que d'afficher « données manquantes » — ce que faisait
 * l'écran d'avis —, on met la destination de côté, on envoie vers la
 * connexion, et la garde de `(auth)/_layout` y ramène une fois le compte
 * authentifié — uniquement pour un compte client, jamais pour un pro.
 *
 * Volontairement en mémoire (pas d'AsyncStorage) : une intention de
 * navigation ne doit pas survivre à la fermeture de l'app, sinon l'ouverture
 * suivante partirait sur un écran que l'utilisateur n'a pas demandé.
 */

let pending: string | null = null;

export function setPendingRoute(path: string): void {
  pending = path;
}

/** Retourne la destination et la consomme (un seul usage). */
export function consumePendingRoute(): string | null {
  const p = pending;
  pending = null;
  return p;
}
