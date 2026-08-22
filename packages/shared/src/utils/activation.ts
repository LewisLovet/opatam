/**
 * Activation d'un compte prestataire — LA définition officielle.
 *
 * « Activé » ne veut pas dire « inscrit » : un commercial est récompensé pour
 * des comptes qui TRAVAILLENT, pas pour des comptes vides. Même philosophie
 * que computeEntitlements : tout est calculé à la lecture depuis l'état réel,
 * rien n'est matérialisé — un compte qui dépublie sa page ou supprime ses
 * prestations cesse d'être activé au moment où c'est vrai.
 *
 * Les quatre critères, et d'où vient chaque mesure :
 *  - page publiée .............. provider.isPublished (choix du prestataire)
 *  - ≥ 3 prestations actives ... compté sur la sous-collection services
 *  - disponibilités posées ..... au moins une règle d'availability
 *  - première réservation ...... au moins une résa non annulée, hors démo
 *
 * Le « lien partagé » de l'audit n'est PAS un critère : aucun signal fiable
 * ne le mesure (un lien se partage hors de l'application). Les pages vues
 * sont exposées à titre indicatif, jamais comptées dans le score.
 */

export const ACTIVATION_MIN_SERVICES = 3;

export interface ActivationInput {
  isPublished: boolean;
  activeServicesCount: number;
  hasAvailability: boolean;
  realBookingsCount: number;
  /** Indicatif seulement — voir le commentaire de tête. */
  pageViewsTotal?: number;
}

export interface Activation {
  published: boolean;
  enoughServices: boolean;
  hasAvailability: boolean;
  hasFirstBooking: boolean;
  /** Les quatre critères sont remplis. */
  activated: boolean;
  /** 0 à 4 — pour afficher une progression, jamais pour décider. */
  score: number;
  /** Le premier critère manquant, dans l'ordre du parcours réel d'un
   *  prestataire — c'est la « prochaine meilleure action » du commercial. */
  nextStep: 'publier' | 'prestations' | 'disponibilites' | 'premiere_reservation' | null;
}

export function computeActivation(input: ActivationInput): Activation {
  const published = input.isPublished === true;
  const enoughServices = input.activeServicesCount >= ACTIVATION_MIN_SERVICES;
  const hasAvailability = input.hasAvailability === true;
  const hasFirstBooking = input.realBookingsCount > 0;

  const score = [published, enoughServices, hasAvailability, hasFirstBooking]
    .filter(Boolean).length;

  // L'ordre du parcours réel : on configure prestations et disponibilités
  // AVANT de publier — une page publiée vide ne sert à rien — mais la
  // publication est le déclencheur des réservations, donc le premier manque
  // dans CET ordre est l'action la plus utile maintenant.
  const nextStep = !enoughServices
    ? 'prestations'
    : !hasAvailability
      ? 'disponibilites'
      : !published
        ? 'publier'
        : !hasFirstBooking
          ? 'premiere_reservation'
          : null;

  return {
    published,
    enoughServices,
    hasAvailability,
    hasFirstBooking,
    activated: score === 4,
    score,
    nextStep,
  };
}
