/**
 * Espace membre — l'état d'accès d'un membre, tel que le gérant le voit.
 *
 * Une seule règle pour le site et l'app : à partir des comptes reliés
 * (`memberAccounts`) et des invitations (`memberInvitations`) d'un salon,
 * dire pour UN membre s'il a accès, s'il est invité, si son lien a expiré.
 * Pur : testé par `espace-membre.node.test.mjs`.
 */

export type EtatAccesMembre =
  /** Relié à un compte actif : il se connecte à l'app. */
  | { etat: 'actif'; email: string; depuis: Date | null }
  /** Invitation envoyée, pas encore acceptée, lien encore valable. */
  | { etat: 'invite'; email: string; envoyeeLe: Date | null; expireLe: Date | null }
  /** Invitation envoyée mais lien expiré : à renvoyer. */
  | { etat: 'expire'; email: string; envoyeeLe: Date | null }
  /** Jamais invité, ou accès retiré. */
  | { etat: 'aucun' };

interface CompteLu {
  memberId: string;
  email?: string;
  active?: boolean;
  linkedAt?: Date | null;
}

interface InvitationLue {
  memberId: string;
  email?: string;
  status?: string;
  createdAt?: Date | null;
  expiresAt?: Date | null;
}

const temps = (d: Date | null | undefined) => (d instanceof Date ? d.getTime() : 0);

export function etatAccesMembre(
  memberId: string,
  comptes: readonly CompteLu[],
  invitations: readonly InvitationLue[],
  maintenant: Date = new Date(),
): EtatAccesMembre {
  const compte = comptes.find((c) => c.memberId === memberId && c.active === true);
  if (compte) return { etat: 'actif', email: compte.email ?? '', depuis: compte.linkedAt ?? null };

  // La plus récente des invitations EN ATTENTE ; les remplacées, retirées
  // ou acceptées ne disent plus rien (un compte accepté puis retiré = aucun).
  const enAttente = invitations
    .filter((i) => i.memberId === memberId && i.status === 'pending')
    .sort((a, b) => temps(b.createdAt) - temps(a.createdAt))[0];
  if (!enAttente) return { etat: 'aucun' };
  const expireLe = enAttente.expiresAt ?? null;
  if (expireLe && expireLe.getTime() < maintenant.getTime()) {
    return { etat: 'expire', email: enAttente.email ?? '', envoyeeLe: enAttente.createdAt ?? null };
  }
  return { etat: 'invite', email: enAttente.email ?? '', envoyeeLe: enAttente.createdAt ?? null, expireLe };
}
