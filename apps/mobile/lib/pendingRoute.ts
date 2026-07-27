/**
 * Destination en attente de connexion.
 *
 * Un lien profond peut viser un écran qui exige un compte (laisser un avis,
 * détail d'un RDV). Plutôt que d'afficher « données manquantes » — ce que
 * faisait l'écran d'avis —, on met la destination de côté, on envoie vers la
 * connexion, et la garde de `(auth)/_layout` y ramène une fois le compte
 * authentifié.
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
