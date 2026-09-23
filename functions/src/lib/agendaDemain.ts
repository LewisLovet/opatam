/**
 * « Demain » pour le récapitulatif du soir — CHEZ LE SALON.
 *
 * Le cron de 20 h calculait la journée de demain en Europe/Paris, pour
 * tout le monde, puis interrogeait Firestore sur cette plage. À La
 * Réunion (Paris + 2 ou + 3 h), la plage parisienne déborde sur deux
 * journées locales : le récapitulatif pouvait lister des rendez-vous du
 * surlendemain matin et rater ceux de la fin de journée — puis afficher
 * chaque heure décalée.
 *
 * Deux règles, extraites ici pour être testées sans Firestore :
 *  - « demain » est une DATE calendaire dans le fuseau du salon, jamais
 *    `maintenant + 24 h` (faux deux jours par an) ;
 *  - la journée d'un rendez-vous est sa date LOCALE figée (`localDate`)
 *    quand elle existe, sinon celle recalculée dans son propre fuseau.
 */

import { ajouterJours, jourLocal } from './fuseaux';

/** « YYYY-MM-DD » de demain, tel que le salon le vit maintenant. */
export function demainChezLeSalon(now: Date, fuseauDuSalon: string): string {
  return ajouterJours(jourLocal(now, fuseauDuSalon), 1);
}

/** Ce qu'il faut d'une réservation pour la dater. */
export interface ReservationDatable {
  datetime: Date;
  /** Fuseau figé à la réservation. Absent avant le chantier fuseaux. */
  timezone?: string | null;
  /** Date locale figée. Absente avant le chantier fuseaux. */
  localDate?: string | null;
}

/** La journée locale de ce rendez-vous, chez le salon. */
export function journeeDuRendezVous(rdv: ReservationDatable, fuseauDuSalon: string): string {
  if (rdv.localDate) return rdv.localDate;
  return jourLocal(rdv.datetime, rdv.timezone || fuseauDuSalon);
}

/** Ce rendez-vous a-t-il lieu demain, du point de vue du salon ? */
export function estDemainChezLeSalon(
  rdv: ReservationDatable,
  now: Date,
  fuseauDuSalon: string,
): boolean {
  return journeeDuRendezVous(rdv, fuseauDuSalon) === demainChezLeSalon(now, fuseauDuSalon);
}

/**
 * Fenêtre Firestore qui contient « demain » dans TOUS les fuseaux.
 *
 * On part de demain à Paris (le repère du cron), élargi de 15 h avant et
 * 13 h après : assez pour couvrir de UTC+14 à UTC−12. Ce n'est qu'un
 * SUR-ENSEMBLE — c'est `estDemainChezLeSalon`, appliqué à chaque
 * réservation, qui décide. Une fenêtre trop large coûte quelques lectures ;
 * une fenêtre trop étroite fait disparaître des rendez-vous.
 */
export function fenetreDeRechercheDemain(now: Date): { debut: Date; fin: Date } {
  const demainParis = demainChezLeSalon(now, 'Europe/Paris');
  // Minuit UTC de cette date, puis marges.
  const minuitUtc = new Date(`${demainParis}T00:00:00Z`).getTime();
  const H = 60 * 60 * 1000;
  return {
    debut: new Date(minuitUtc - 15 * H),
    fin: new Date(minuitUtc + 24 * H + 13 * H),
  };
}
