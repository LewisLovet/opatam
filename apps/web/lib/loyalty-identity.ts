/**
 * Identité d'une carte de fidélité — côté serveur uniquement.
 *
 * LE PROBLÈME. Une fiche client vit dans `providerClients/{providerId}_{clientKey}`
 * où `clientKey` est dérivé de l'EMAIL (canon `getClientKey`, email-first).
 * Deux emails coexistent pour un même utilisateur :
 *   - celui de son compte Firebase (`decoded.email`) ;
 *   - celui saisi dans le formulaire de réservation (`clientInfo.email`),
 *     pré-rempli depuis son profil — qui n'est pas forcément le même, et
 *     qu'il peut modifier.
 *
 * L'activation dérivait sa clé du premier, les réservations du second : dès
 * qu'ils divergeaient, l'activation créait une fiche fantôme à côté de la
 * vraie. Le client voyait « carte activée », le compteur restait sur l'autre
 * fiche, et la récompense ne s'armait jamais.
 *
 * LA RÈGLE. L'identité qui fait foi n'est pas un email, c'est l'UID : la
 * fiche d'un client inscrit porte son `clientId`. C'est déjà la résolution
 * de `GET /api/loyalty/me` — donc exactement la carte que le client voit à
 * l'écran quand il appuie sur « activer ».
 *
 * Corollaire : aucune clé envoyée par le client (mobile ou web) n'est
 * utilisée telle quelle. Le serveur retrouve la fiche par l'UID, et
 * n'adopte une fiche orpheline (créée par une résa saisie par le pro, sans
 * compte) que si l'email du token est VÉRIFIÉ — `verifyIdToken()` prouve
 * l'identité du compte, pas la possession de l'adresse.
 */

import type { Firestore, DocumentData, DocumentReference } from 'firebase-admin/firestore';
import { isLoyaltyCardActivated } from '@booking-app/shared';

export interface OwnedProviderClient {
  ref: DocumentReference;
  data: DocumentData;
  clientKey: string;
}

/**
 * Fiches de ce prestataire appartenant à cet UID, la plus avancée d'abord
 * (un client ayant réservé sous deux emails a deux fiches ; celle qui porte
 * le plus de tampons est celle qu'il regarde).
 *
 * Une seule égalité (`clientId`) — pas d'index composite, même requête que
 * `/api/loyalty/me`.
 */
export async function findOwnedProviderClients(
  db: Firestore,
  providerId: string,
  uid: string,
): Promise<OwnedProviderClient[]> {
  const snap = await db
    .collection('providerClients')
    .where('clientId', '==', uid)
    .limit(100)
    .get();

  return snap.docs
    .filter((d) => d.data().providerId === providerId)
    .map((d) => ({
      ref: d.ref,
      data: d.data(),
      clientKey: (d.data().clientKey as string) ?? d.id.slice(providerId.length + 1),
    }))
    .sort(
      (a, b) =>
        ((b.data.loyaltyConfirmedCount as number | undefined) ?? 0) -
        ((a.data.loyaltyConfirmedCount as number | undefined) ?? 0),
    );
}

/**
 * LA carte de fidélité d'un client chez un prestataire — une seule, toujours.
 *
 * L'identité est le couple (`clientId` Firebase Auth, `providerId`). Les
 * fiches `providerClients`, elles, restent découpées par email : c'est le
 * canon de l'agrégation CRM (`getClientKey`), et un client qui réserve sous
 * deux adresses en produit deux. La carte les RÉUNIT à la lecture plutôt que
 * de réécrire l'historique :
 *
 *  - les compteurs s'additionnent sans risque de double comptage. Chaque
 *    fiche ne compte que les réservations portant SON email, et
 *    `loyaltyConfirmedCount` exige déjà un `clientId` : la somme sur les
 *    fiches de cet UID vaut donc exactement le nombre de rendez-vous
 *    honorés du client chez ce pro, quelle que soit l'adresse utilisée ;
 *  - l'ajustement manuel du pro s'additionne de la même façon, où qu'il
 *    l'ait posé ;
 *  - la carte est activée dès qu'UNE fiche l'est — l'activation est une
 *    intention par prestataire, pas par adresse email.
 *
 * La fiche `primary` porte l'écriture (activation, opt-in) et sert de clé
 * stable. Choix déterministe : la fiche déjà activée d'abord, sinon la plus
 * fournie, sinon l'id le plus petit — pour que deux appels concurrents
 * désignent toujours la même.
 */
export interface LoyaltyCardIdentity {
  primary: OwnedProviderClient | null;
  /** Toutes les fiches de cet UID chez ce pro. Plus d'une = doublon
   *  historique, réuni ici et invisible pour le client. */
  all: OwnedProviderClient[];
  confirmedCount: number;
  adjustment: number;
  /** Compte EFFECTIF affiché et utilisé pour armer la récompense. */
  effectiveCount: number;
  activated: boolean;
  promoEmailsOptIn: boolean;
}

/** Clé de rédemption stable, indépendante des emails utilisés. */
export function loyaltyRedemptionKey(uid: string): string {
  return `id:${uid}`;
}

export function buildLoyaltyCardIdentity(docs: OwnedProviderClient[]): LoyaltyCardIdentity {
  const sorted = [...docs].sort((a, b) => {
    const actA = isLoyaltyCardActivated(a.data) ? 0 : 1;
    const actB = isLoyaltyCardActivated(b.data) ? 0 : 1;
    if (actA !== actB) return actA - actB;
    const countDiff =
      ((b.data.loyaltyConfirmedCount as number | undefined) ?? 0) -
      ((a.data.loyaltyConfirmedCount as number | undefined) ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.ref.id.localeCompare(b.ref.id);
  });

  const confirmedCount = docs.reduce(
    (n, d) => n + ((d.data.loyaltyConfirmedCount as number | undefined) ?? 0),
    0,
  );
  const adjustment = docs.reduce(
    (n, d) => n + ((d.data.loyaltyAdjustment as number | undefined) ?? 0),
    0,
  );

  return {
    primary: sorted[0] ?? null,
    all: sorted,
    confirmedCount,
    adjustment,
    effectiveCount: Math.max(0, confirmedCount + adjustment),
    activated: docs.some((d) => isLoyaltyCardActivated(d.data)),
    promoEmailsOptIn: docs.some((d) => d.data.promoEmailsOptIn === true),
  };
}

/** Raccourci lecture : retrouve les fiches puis en fait une carte unique. */
export async function resolveLoyaltyCard(
  db: Firestore,
  providerId: string,
  uid: string,
): Promise<LoyaltyCardIdentity> {
  return buildLoyaltyCardIdentity(await findOwnedProviderClients(db, providerId, uid));
}
