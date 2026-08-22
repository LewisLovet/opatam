/**
 * Autorisation du rattachement d'un code affilié à un prestataire.
 *
 * Fonction PURE, séparée de la route pour être testée sans HTTP ni Firestore :
 * la route vérifie le jeton (Firebase Admin), lit les documents, puis délègue
 * ici toute la décision. Une seule implémentation, pas de logique dupliquée
 * entre web et mobile — les deux inscriptions appellent la même route.
 *
 * Règles :
 *  - appelant authentifié obligatoire ;
 *  - il ne rattache que SON prestataire (uid === providerId, et le document
 *    doit le confirmer via `userId` — deux vérifications distinctes, car un
 *    document mal créé pourrait porter un autre userId) ;
 *  - un prestataire déjà rattaché n'est JAMAIS réattribué ;
 *  - le code doit correspondre à un affilié actif.
 */
export interface AffiliateLinkInput {
  /** uid du jeton vérifié — null si aucun jeton valide. */
  authUid: string | null;
  /** Cible demandée dans le body. */
  providerId: string;
  /** Document provider tel que lu — null s'il n'existe pas. */
  provider: { userId?: string | null; affiliateId?: string | null } | null;
  /** Affilié actif correspondant au code — null si introuvable/inactif. */
  affiliate: { id: string } | null;
}

export type AffiliateLinkDecision =
  | { ok: true; alreadyLinked: false; affiliateId: string }
  | { ok: true; alreadyLinked: true }
  | { ok: false; status: 401 | 403 | 404; error: string };

export function decideAffiliateLink(input: AffiliateLinkInput): AffiliateLinkDecision {
  const { authUid, providerId, provider, affiliate } = input;

  if (!authUid) {
    return { ok: false, status: 401, error: 'Authentification requise' };
  }
  if (authUid !== providerId) {
    return { ok: false, status: 403, error: 'Un prestataire ne rattache que son propre compte' };
  }
  if (!provider) {
    return { ok: false, status: 404, error: 'Prestataire introuvable' };
  }
  if (provider.userId !== authUid) {
    return { ok: false, status: 403, error: 'Ce compte prestataire ne vous appartient pas' };
  }
  // Jamais de réattribution : le premier code rattaché est définitif.
  if (provider.affiliateId) {
    return { ok: true, alreadyLinked: true };
  }
  if (!affiliate) {
    return { ok: false, status: 404, error: 'Code invalide' };
  }
  return { ok: true, alreadyLinked: false, affiliateId: affiliate.id };
}
