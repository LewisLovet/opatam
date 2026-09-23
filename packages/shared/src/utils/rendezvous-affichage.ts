/**
 * À quelle heure ce rendez-vous a-t-il lieu ? — LE lecteur unique.
 *
 * ── Le problème qu'il résout ────────────────────────────────────────────
 * `Europe/Paris` est écrit en dur à 120 endroits : agenda pro, espace
 * client, e-mails, notifications, rappels, récapitulatif, export calendrier,
 * écran du salon, statistiques. Les réécrire un par un, c'est 66 fichiers
 * et autant d'occasions d'en oublier un — qui resterait faux sans que rien
 * ne le signale.
 *
 * D'où ce lecteur : une surface qui l'adopte devient juste, sans rien
 * savoir des fuseaux. La migration se fait fichier par fichier, et ce qui
 * n'a pas encore migré continue de fonctionner exactement comme avant.
 *
 * ── Pourquoi l'heure FIGÉE prime ────────────────────────────────────────
 * `localStartTime` est l'heure convenue, écrite au moment de la
 * réservation. La recalculer depuis l'instant donnerait la même chose
 * aujourd'hui — mais si le professionnel corrige le fuseau de son lieu
 * (ou déménage), tous ses rendez-vous PASSÉS changeraient d'heure à
 * l'écran. Une confirmation disant « 08:00 » doit continuer à dire 08:00.
 */

import { heureLocale, jourLocal, normaliserFuseau } from './fuseaux';

/**
 * Ce dont on a besoin d'un rendez-vous — pas le type complet, pour rester
 * utilisable côté client comme côté serveur.
 */
export interface RendezVousAffichable {
  datetime: Date;
  endDatetime?: Date | null;
  /** Fuseau du lieu, figé à la réservation. Absent avant le chantier fuseaux. */
  timezone?: string | null;
  /** Heure locale convenue, figée. Absente avant le chantier fuseaux. */
  localStartTime?: string | null;
  localEndTime?: string | null;
  localDate?: string | null;
}

/**
 * Le fuseau dans lequel AFFICHER ce rendez-vous.
 *
 * `Europe/Paris` en repli n'est pas une supposition sur le salon : c'est
 * exactement ce que faisaient les 120 occurrences en dur. Pour une
 * réservation d'avant le chantier, c'est donc le comportement inchangé —
 * pas une régression déguisée en correction.
 */
export function fuseauDAffichage(
  rdv: RendezVousAffichable,
  repli = 'Europe/Paris',
): string {
  return normaliserFuseau(rdv.timezone) ?? repli;
}

/** « 08:30 » — l'heure convenue, telle qu'elle a été annoncée. */
export function heureDuRendezVous(rdv: RendezVousAffichable, repli?: string): string {
  if (rdv.localStartTime) return rdv.localStartTime;
  return heureLocale(rdv.datetime, fuseauDAffichage(rdv, repli));
}

/** « 09:00 » — l'heure de fin convenue. `null` si la fin est inconnue. */
export function finDuRendezVous(rdv: RendezVousAffichable, repli?: string): string | null {
  if (rdv.localEndTime) return rdv.localEndTime;
  if (!rdv.endDatetime) return null;
  return heureLocale(rdv.endDatetime, fuseauDAffichage(rdv, repli));
}

/** « 2026-09-23 » — la date convenue, chez le salon. */
export function jourDuRendezVous(rdv: RendezVousAffichable, repli?: string): string {
  if (rdv.localDate) return rdv.localDate;
  return jourLocal(rdv.datetime, fuseauDAffichage(rdv, repli));
}

/**
 * « 08:30 – 09:00 », ou juste l'heure de début quand la fin est inconnue.
 * Le tiret est un tiret demi-cadratin entouré d'espaces, comme ailleurs.
 */
export function plageDuRendezVous(rdv: RendezVousAffichable, repli?: string): string {
  const debut = heureDuRendezVous(rdv, repli);
  const fin = finDuRendezVous(rdv, repli);
  return fin ? `${debut} – ${fin}` : debut;
}

/**
 * Faut-il préciser le fuseau à CE lecteur ?
 *
 * Une cliente parisienne qui réserve chez un salon réunionnais voit
 * « 08:00 » : c'est l'heure du salon, et c'est la bonne — mais sans
 * mention, elle comprendra 08:00 chez elle. On ne le précise donc que
 * lorsque les deux fuseaux diffèrent VRAIMENT à cet instant : deux fuseaux
 * de noms différents mais de même décalage (Paris et Berlin) n'ont pas
 * besoin d'être signalés.
 */
export function fuseauADistinguer(
  rdv: RendezVousAffichable,
  fuseauDuLecteur: string | null | undefined,
): boolean {
  const salon = normaliserFuseau(rdv.timezone);
  const lecteur = normaliserFuseau(fuseauDuLecteur);
  if (!salon || !lecteur || salon === lecteur) return false;
  return heureLocale(rdv.datetime, salon) !== heureLocale(rdv.datetime, lecteur);
}
