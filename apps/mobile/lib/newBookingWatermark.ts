/**
 * Décision « est-ce une nouvelle réservation ? » — logique PURE et testable.
 *
 * Extraite de `appReview.ts` parce que c'est le seul endroit où l'on peut se
 * tromper silencieusement : le repère ne doit JAMAIS reculer. L'écran du
 * planning applique des filtres de période, donc un même prestataire voit
 * tantôt 12 résas, tantôt 2. Si un affichage plus étroit rabaissait le
 * repère, les réservations déjà vues repasseraient pour neuves à la
 * consultation suivante — et la fenêtre de 120 jours partirait pour rien.
 *
 * Le reste (stockage, compteur, popup) vit dans `appReview.ts` : ça touche
 * AsyncStorage et un module natif, ce n'est pas testable ici.
 */

export interface NewBookingDecision {
  /** Compter un moment positif ? */
  shouldCount: boolean;
  /** Nouvelle valeur à stocker, ou `null` si le repère ne change pas. */
  nextWatermark: number | null;
}

/**
 * @param latestCreatedAtMs création la plus récente parmi les résas affichées
 * @param storedRaw         repère lu du stockage (`null` = jamais consulté)
 */
export function decideNewBookingMoment(
  latestCreatedAtMs: number,
  storedRaw: string | null,
): NewBookingDecision {
  if (!Number.isFinite(latestCreatedAtMs) || latestCreatedAtMs <= 0) {
    return { shouldCount: false, nextWatermark: null };
  }

  const seen = storedRaw !== null ? Number(storedRaw) : NaN;
  // Repère absent OU illisible : on repart de cet affichage sans rien
  // compter, sinon tout l'historique d'un prestataire déjà installé
  // passerait pour une bonne nouvelle du jour.
  if (!Number.isFinite(seen)) {
    return { shouldCount: false, nextWatermark: latestCreatedAtMs };
  }

  if (latestCreatedAtMs <= seen) {
    return { shouldCount: false, nextWatermark: null };
  }

  return { shouldCount: true, nextWatermark: latestCreatedAtMs };
}
