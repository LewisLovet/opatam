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
 *   - la période saisie est la PREMIÈRE occurrence, reprise VERBATIM ; sa
 *     durée (en jours calendaires) et ses heures valent pour les suivantes ;
 *   - `weekdays` : les jours de la semaine où une occurrence COMMENCE
 *     (`Date.getDay()` : 0 = dimanche … 6 = samedi). Il doit contenir le jour
 *     de la période saisie, sinon celle-ci ne serait pas une occurrence
 *     d'elle-même — `reglePourPeriode` s'en charge, et c'est le SEUL endroit
 *     qui décide ;
 *   - `intervalWeeks` : 1 = chaque semaine, 2 = une semaine sur deux… Les
 *     semaines sont comptées à partir de celle de la période saisie
 *     (semaines du lundi au dimanche) ;
 *   - `until` : dernier jour où une occurrence peut COMMENCER, inclus. C'est
 *     une DATE CALENDAIRE (« YYYY-MM-DD »), pas un instant : « jusqu'au
 *     3 mai » veut dire la même chose à Paris et à Nouméa, et rouvrir la
 *     série depuis un autre fuseau ne déplace plus son dernier jour.
 *
 * LE FUSEAU. Sans horloge, l'arithmétique est celle de l'appareil : c'est
 * ce que font déjà les formulaires, et cela suffit tant que le pro et son
 * salon sont au même endroit. Avec l'horloge du LIEU
 * (`horlogeDuFuseau(tz)`), chaque occurrence garde l'heure murale DU SALON,
 * y compris de part et d'autre d'un changement d'heure et même si le pro
 * saisit depuis un autre pays. Le service passe toujours celle du lieu ;
 * les écrans la passent dès qu'ils la connaissent, pour que l'aperçu
 * annonce ce qui sera écrit.
 */
/**
 * Une date calendaire, « YYYY-MM-DD ». Volontairement redéclarée ici plutôt
 * qu'importée de `fuseaux.ts` : ce module ne dépend de rien, et c'est le
 * même type (un alias de `string`).
 */
type JourCalendaire = string;

/**
 * Ce qu'il faut savoir d'un fuseau pour poser des occurrences dedans.
 *
 * INJECTÉE, pas importée : ce module reste sans dépendance, donc chargeable
 * tel quel par `node --test`, et la résolution des heures qui n'existent pas
 * (ou qui existent deux fois) reste au seul endroit qui la traite
 * correctement — `fuseaux.ts`. `horlogeDuFuseau` en fabrique une.
 */
export interface HorlogeLocale {
  /** Le jour calendaire d'un instant, dans ce fuseau. */
  jour(d: Date): JourCalendaire;
  /** Les minutes depuis minuit d'un instant, dans ce fuseau. */
  minutes(d: Date): number;
  /** L'instant de cette heure murale, ce jour-là, dans ce fuseau. */
  instant(jour: JourCalendaire, minutes: number): Date;
}

export interface RecurrenceRule {
  /** 1 = chaque semaine, 2 = toutes les deux semaines… borné par `INTERVALLE_MAX_SEMAINES`. */
  intervalWeeks: number;
  /** Jours de départ des occurrences, `Date.getDay()` (0 = dimanche). */
  weekdays: number[];
  /** Dernier jour de départ possible, INCLUS — « YYYY-MM-DD », pas un instant. */
  until: JourCalendaire;
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

/** Jour calendaire local à l'APPAREIL, comparable (`YYYY-MM-DD`). */
export function jourLocalDe(d: Date): JourCalendaire {
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

/** Décale une date CALENDAIRE de n jours. Arithmétique de calendrier, sans fuseau. */
export function ajouterJoursCal(jour: JourCalendaire, n: number): JourCalendaire {
  const [an, mo, jo] = jour.split('-').map(Number);
  const d = new Date(Date.UTC(2000, mo - 1, jo + n));
  d.setUTCFullYear(an, mo - 1, jo + n);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const j = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${j}`;
}

/** Jour de la semaine d'une date CALENDAIRE — 0 = dimanche, partout pareil. */
export function jourSemaineCal(jour: JourCalendaire): number {
  const [an, mo, jo] = jour.split('-').map(Number);
  const d = new Date(Date.UTC(2000, mo - 1, jo));
  d.setUTCFullYear(an, mo - 1, jo);
  return d.getUTCDay();
}

/** Nombre de jours entre deux dates CALENDAIRES (`YYYY-MM-DD`), signé. */
export function joursEntreJours(a: JourCalendaire, b: JourCalendaire): number {
  const ms = (j: JourCalendaire) => {
    const [an, mo, jo] = j.split('-').map(Number);
    return Date.UTC(an, mo - 1, jo);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** Même heure murale, `n` jours calendaires plus tard, dans le fuseau de l'appareil. */
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

/**
 * La règle EFFECTIVE pour cette période — l'unique endroit qui décide des
 * jours répétés.
 *
 * Deux invariants, que ni un écran ni un appelant n'ont à redire :
 *   - le jour de la période saisie fait toujours partie des jours répétés,
 *     puisque cette période EST la première occurrence ;
 *   - une période de plusieurs jours ne se répète que sur son jour de
 *     départ : « du samedi au dimanche, les mardis aussi » n'a pas de sens.
 *
 * L'aperçu à l'écran et l'écriture passent par ici, sinon l'un annonce ce
 * que l'autre n'écrit pas — c'est exactement ce qui arrivait quand le
 * formulaire normalisait pour afficher mais enregistrait le brouillon.
 */
export function reglePourPeriode(
  rule: RecurrenceRule,
  base: PeriodeDeBase,
  horloge?: HorlogeLocale,
): RecurrenceRule {
  const debut = jourDe(base.startDate, horloge);
  const jourBase = jourSemaineCal(debut);
  const multiJours = joursEntreJours(debut, jourDe(base.endDate, horloge)) > 0;
  const weekdays = multiJours ? [jourBase] : trierJoursSemaine([...rule.weekdays, jourBase]);
  return { ...rule, weekdays };
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
export function raisonRegleInvalide(
  base: PeriodeDeBase,
  rule: RecurrenceRule,
  horloge?: HorlogeLocale,
): RegleInvalide | null {
  if (!Number.isInteger(rule.intervalWeeks) || rule.intervalWeeks < 1 || rule.intervalWeeks > INTERVALLE_MAX_SEMAINES) {
    return 'intervalle';
  }
  const jours = trierJoursSemaine(rule.weekdays);
  if (jours.length === 0 || jours.some((j) => !Number.isInteger(j) || j < 0 || j > 6)) {
    return 'aucunJour';
  }
  const debut = jourDe(base.startDate, horloge);
  if (!jours.includes(jourSemaineCal(debut))) return 'jourDeBaseAbsent';
  const duree = joursEntreJours(debut, jourDe(base.endDate, horloge));
  if (duree < 0) return 'finAvantDebut';
  if (duree > 0 && jours.length > 1) return 'plusieursJoursMultiJours';
  const horizon = joursEntreJours(debut, rule.until);
  if (horizon < 0) return 'finAvantPremiere';
  if (horizon > HORIZON_MAX_JOURS) return 'horizon';
  return null;
}

/** Le message français de `raisonRegleInvalide`, ou `null`. */
export function messageRegleInvalide(
  base: PeriodeDeBase,
  rule: RecurrenceRule,
  horloge?: HorlogeLocale,
): string | null {
  const code = raisonRegleInvalide(base, rule, horloge);
  return code ? MESSAGES_REGLE_INVALIDE[code] : null;
}

/**
 * Toutes les occurrences de la série, la période de base comprise, par
 * ordre chronologique. Lève si la règle est invalide : appeler
 * `raisonRegleInvalide` d'abord pour un message à afficher.
 *
 * Passez l'horloge du LIEU pour que chaque occurrence garde l'heure murale
 * du salon ; sans elle, c'est l'heure murale de l'appareil.
 */
export function genererOccurrences(
  base: PeriodeDeBase,
  rule: RecurrenceRule,
  horloge?: HorlogeLocale,
): Occurrence[] {
  const raison = messageRegleInvalide(base, rule, horloge);
  if (raison) throw new Error(raison);

  const jourDebut = jourDe(base.startDate, horloge);
  const jourFin = jourDe(base.endDate, horloge);
  const duree = joursEntreJours(jourDebut, jourFin);
  const jours = trierJoursSemaine(rule.weekdays);
  const jourLimite = rule.until;
  // Lundi de la semaine de la période de base.
  const lundi = ajouterJoursCal(jourDebut, -depuisLundi(jourSemaineCal(jourDebut)));
  // Les heures murales à reproduire — du salon si on a son horloge.
  const minDebut = horloge ? horloge.minutes(base.startDate) : null;
  const minFin = horloge ? horloge.minutes(base.endDate) : null;

  const occurrences: Occurrence[] = [];
  for (let semaine = 0; ; semaine += rule.intervalWeeks) {
    let auDela = false;
    for (const weekday of jours) {
      const jour = ajouterJoursCal(lundi, semaine * 7 + depuisLundi(weekday));
      if (jour < jourDebut) continue;
      if (jour > jourLimite) { auDela = true; break; }
      if (jour === jourDebut) {
        // La période saisie, VERBATIM : elle est la première occurrence, et
        // la recomposer depuis ses composantes en perdrait les secondes.
        occurrences.push({ startDate: base.startDate, endDate: base.endDate });
      } else if (horloge && minDebut !== null && minFin !== null) {
        occurrences.push({
          startDate: horloge.instant(jour, minDebut),
          endDate: horloge.instant(ajouterJoursCal(jour, duree), minFin),
        });
      } else {
        const ecart = joursEntreJours(jourDebut, jour);
        occurrences.push({
          startDate: decalerJours(base.startDate, ecart),
          endDate: decalerJours(base.endDate, ecart),
        });
      }
      if (occurrences.length > OCCURRENCES_MAX) {
        throw new Error('Trop d’occurrences : réduisez la période de répétition');
      }
    }
    if (auDela) break;
  }
  return occurrences;
}

/** Le jour calendaire d'un instant — celui du lieu si on a son horloge. */
function jourDe(d: Date, horloge?: HorlogeLocale): JourCalendaire {
  return horloge ? horloge.jour(d) : jourLocalDe(d);
}
