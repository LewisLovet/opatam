/**
 * Récurrence d'une période bloquée — le générateur d'occurrences.
 *
 * Le parti pris : une récurrence n'est PAS une règle dépliée à la lecture,
 * c'est une SÉRIE d'occurrences matérialisées. Chaque occurrence est un
 * vrai `blockedSlot`, qui porte `seriesId` et une copie de la règle. Le
 * moteur de disponibilités, les agendas, l'écran du salon, le widget, les
 * stats : aucun lecteur ne change, et une application non mise à jour voit
 * les blocages comme avant. Le prix, c'est ce fichier : produire les bonnes
 * dates, une fois, à la création.
 *
 * Sémantique :
 *   - la période saisie est la PREMIÈRE occurrence ; sa durée (en jours
 *     calendaires) et ses heures sont reprises telles quelles ;
 *   - `weekdays` : les jours de la semaine où une occurrence COMMENCE
 *     (`Date.getDay()` : 0 = dimanche … 6 = samedi). Il doit contenir le jour
 *     de la période saisie, sinon celle-ci ne serait pas une occurrence
 *     d'elle-même ;
 *   - `intervalWeeks` : 1 = chaque semaine, 2 = une semaine sur deux… Les
 *     semaines sont comptées à partir de celle de la période saisie
 *     (semaines du lundi au dimanche) ;
 *   - `until` : dernier jour où une occurrence peut COMMENCER, inclus.
 *
 * Arithmétique de CALENDRIER, jamais de durées : « samedi prochain à 9 h »
 * est une date locale, pas « + 7 × 24 h ». Les dates sont construites par
 * leurs composantes locales, ce qui traverse les changements d'heure sans
 * décaler l'heure murale — exactement comme les formulaires qui saisissent
 * la période de base.
 *
 * Aucun import : ce module est chargé tel quel par `node --test`.
 */

export interface RecurrenceRule {
  /** 1 = chaque semaine, 2 = toutes les deux semaines… borné par `INTERVALLE_MAX_SEMAINES`. */
  intervalWeeks: number;
  /** Jours de départ des occurrences, `Date.getDay()` (0 = dimanche). */
  weekdays: number[];
  /** Dernier jour de départ possible, inclus (l'heure est ignorée). */
  until: Date;
}

export interface PeriodeDeBase {
  startDate: Date;
  endDate: Date;
}

export interface Occurrence {
  startDate: Date;
  endDate: Date;
}

/** Au-delà, la saisie est suspecte : un an de semaines fait 53. */
export const INTERVALLE_MAX_SEMAINES = 4;
/** Une série ne dépasse pas un an : `until` ≤ départ + 366 jours. */
export const HORIZON_MAX_JOURS = 366;
/** 7 jours × 53 semaines : la borne haute théorique, et une garde. */
export const OCCURRENCES_MAX = 371;

/** Jour calendaire local, comparable (`YYYY-MM-DD`). */
export function jourLocalDe(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/** Nombre de jours calendaires locaux de `a` à `b` (b − a), signé. */
export function joursEntre(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** Même heure murale, `n` jours calendaires plus tard. */
export function decalerJours(d: Date, n: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

/** Décalage d'un jour de la semaine par rapport au lundi (lundi = 0 … dimanche = 6). */
export function depuisLundi(weekday: number): number {
  return (weekday + 6) % 7;
}

/** Les jours proposés dans l'ordre lundi → dimanche, dédoublonnés. */
export function trierJoursSemaine(weekdays: number[]): number[] {
  return Array.from(new Set(weekdays)).sort((a, b) => depuisLundi(a) - depuisLundi(b));
}

/** Pourquoi une règle est irrecevable — un code, que chaque surface traduit. */
export type RegleInvalide =
  | 'intervalle'
  | 'aucunJour'
  | 'jourDeBaseAbsent'
  | 'plusieursJoursMultiJours'
  | 'finAvantDebut'
  | 'finAvantPremiere'
  | 'horizon';

/** Les messages en français — le web pro et le service parlent français. */
export const MESSAGES_REGLE_INVALIDE: Record<RegleInvalide, string> = {
  intervalle: `L'intervalle doit être entre 1 et ${INTERVALLE_MAX_SEMAINES} semaines`,
  aucunJour: 'Choisissez au moins un jour de la semaine',
  jourDeBaseAbsent: 'Le jour de la période saisie doit faire partie des jours répétés',
  plusieursJoursMultiJours: 'Une période de plusieurs jours ne se répète que sur un seul jour de la semaine',
  finAvantDebut: 'La date de fin doit être après ou égale à la date de début',
  finAvantPremiere: 'La date de fin de répétition doit être après la première occurrence',
  horizon: 'Une répétition ne peut pas dépasser un an',
};

/**
 * Pourquoi cette règle est-elle irrecevable ? `null` si elle est valide.
 * Miroir de la règle du schéma zod — un seul endroit décide. Rend un CODE :
 * le mobile le traduit dans la langue de l'app, le web prend le français
 * par `messageRegleInvalide`.
 */
export function raisonRegleInvalide(base: PeriodeDeBase, rule: RecurrenceRule): RegleInvalide | null {
  if (!Number.isInteger(rule.intervalWeeks) || rule.intervalWeeks < 1 || rule.intervalWeeks > INTERVALLE_MAX_SEMAINES) {
    return 'intervalle';
  }
  const jours = trierJoursSemaine(rule.weekdays);
  if (jours.length === 0 || jours.some((j) => !Number.isInteger(j) || j < 0 || j > 6)) {
    return 'aucunJour';
  }
  if (!jours.includes(base.startDate.getDay())) return 'jourDeBaseAbsent';
  const duree = joursEntre(base.startDate, base.endDate);
  if (duree < 0) return 'finAvantDebut';
  if (duree > 0 && jours.length > 1) return 'plusieursJoursMultiJours';
  const horizon = joursEntre(base.startDate, rule.until);
  if (horizon < 0) return 'finAvantPremiere';
  if (horizon > HORIZON_MAX_JOURS) return 'horizon';
  return null;
}

/** Le message français de `raisonRegleInvalide`, ou `null`. */
export function messageRegleInvalide(base: PeriodeDeBase, rule: RecurrenceRule): string | null {
  const code = raisonRegleInvalide(base, rule);
  return code ? MESSAGES_REGLE_INVALIDE[code] : null;
}

/**
 * Toutes les occurrences de la série, la période de base comprise, par
 * ordre chronologique. Lève si la règle est invalide : appeler
 * `raisonRegleInvalide` d'abord pour un message à afficher.
 */
export function genererOccurrences(base: PeriodeDeBase, rule: RecurrenceRule): Occurrence[] {
  const raison = messageRegleInvalide(base, rule);
  if (raison) throw new Error(raison);

  const duree = joursEntre(base.startDate, base.endDate);
  const jours = trierJoursSemaine(rule.weekdays);
  const jourBase = jourLocalDe(base.startDate);
  const jourLimite = jourLocalDe(rule.until);
  // Lundi de la semaine de la période de base, à l'heure de début.
  const lundi = decalerJours(base.startDate, -depuisLundi(base.startDate.getDay()));

  const occurrences: Occurrence[] = [];
  for (let semaine = 0; ; semaine += rule.intervalWeeks) {
    let auDela = false;
    for (const weekday of jours) {
      const depart = decalerJours(lundi, semaine * 7 + depuisLundi(weekday));
      const jour = jourLocalDe(depart);
      if (jour < jourBase) continue;
      if (jour > jourLimite) { auDela = true; break; }
      // La fin garde l'heure de fin saisie, `duree` jours après le départ.
      const finBase = base.endDate;
      const fin = new Date(
        depart.getFullYear(),
        depart.getMonth(),
        depart.getDate() + duree,
        finBase.getHours(),
        finBase.getMinutes(),
        finBase.getSeconds(),
        finBase.getMilliseconds(),
      );
      occurrences.push({ startDate: depart, endDate: fin });
      if (occurrences.length > OCCURRENCES_MAX) {
        throw new Error('Trop d’occurrences : réduisez la période de répétition');
      }
    }
    if (auDela) break;
  }
  return occurrences;
}
