/**
 * Validité de la période d'un créneau bloqué — logique PURE et testable.
 *
 * La règle existait déjà, écrite en dur dans
 * `packages/firebase/src/services/scheduling.service.ts` (`blockPeriod`).
 * Elle ne couvrait donc QUE la création : l'écran mobile d'édition écrit
 * directement via le repository, et une copie approximative y avait laissé
 * passer `00:00 → 00:00`. D'où cette extraction : une seule définition,
 * vérifiable par des tests.
 *
 * LES TROIS CAS, dans l'ordre où ils se présentent :
 *
 *  - journée entière : il n'y a pas d'heures, rien à comparer ;
 *  - jours DIFFÉRENTS : toute combinaison est valide — bloquer du lundi
 *    18 h au mercredi 9 h est parfaitement légitime ;
 *  - même jour : la fin doit être STRICTEMENT postérieure au début.
 *
 * Le cas « 00:00 » en fin de journée vaut MINUIT DE FIN, soit 1440, ce qui
 * autorise `22:00 → 00:00`. Mais `00:00 → 00:00` reste refusé : les deux
 * bornes sont identiques, c'est une saisie ambiguë (journée entière ? durée
 * nulle ?) et non une période. C'est précisément la nuance que la
 * conversion en 1440 faisait sauter si on la testait seule.
 */

/** Minutes depuis minuit. `'09:30'` → 570. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Comme `hhmmToMinutes`, mais `'00:00'` désigne la FIN de journée (1440). */
export function endHhmmToMinutes(hhmm: string): number {
  const m = hhmmToMinutes(hhmm);
  return m === 0 ? 24 * 60 : m;
}

export interface BlockedPeriodInput {
  allDay: boolean;
  /** Vrai quand début et fin tombent le même jour calendaire. */
  sameDay: boolean;
  /** `HH:mm`. Ignorés quand `allDay`. */
  startTime?: string | null;
  endTime?: string | null;
  /**
   * Lecture des heures sur une période multi-jours. `'daily'` répète la même
   * tranche chaque jour : la fin doit donc être après le début, exactement
   * comme sur une période d'un seul jour. `'continuous'` (défaut) décrit un
   * départ et un retour — l'inversion y est légitime, et même attendue :
   * partir vendredi 18:00 pour revenir lundi 09:00.
   */
  spanMode?: 'continuous' | 'daily';
}

/**
 * La période est-elle valide ? Miroir exact de la règle appliquée par
 * `schedulingService.blockPeriod` à la création.
 */
export function isBlockedPeriodValid(input: BlockedPeriodInput): boolean {
  if (input.allDay) return true;
  if (!input.startTime || !input.endTime) return false;
  // Une tranche quotidienne obéit à la même règle qu'une journée unique.
  if (!input.sameDay && input.spanMode !== 'daily') return true;
  // Bornes identiques = saisie ambiguë, refusée telle quelle. Ce test
  // vient AVANT la conversion, sinon `00:00 → 00:00` deviendrait
  // `0 → 1440` et passerait pour une journée valide.
  if (input.startTime === input.endTime) return false;
  return hhmmToMinutes(input.startTime) < endHhmmToMinutes(input.endTime);
}
