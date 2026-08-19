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

/** Minutes dans une journée. Une fenêtre `[0, 1440]` couvre le jour entier. */
export const MINUTES_PAR_JOUR = 24 * 60;

/** Fenêtre bloquée sur UN jour, en minutes depuis minuit. */
export interface BlockedWindow {
  startMin: number;
  endMin: number;
}

/**
 * Ce qu'un blocage retire d'un jour donné. Volontairement détaché de
 * Firestore : dates simples en entrée, minutes en sortie.
 */
export interface BlockedPeriodShape {
  allDay: boolean;
  startDate: Date;
  endDate: Date;
  /** `HH:mm`. Ignorés quand `allDay`. */
  startTime?: string | null;
  endTime?: string | null;
  /** Absent = `'continuous'`. Voir `BlockedPeriodInput.spanMode`. */
  spanMode?: 'continuous' | 'daily';
}

/** Le jour calendaire de `d`, à minuit. */
function auMinuit(d: Date): Date {
  const copie = new Date(d);
  copie.setHours(0, 0, 0, 0);
  return copie;
}

/**
 * Quelle tranche du jour `jour` ce blocage retire-t-il ? `null` s'il ne le
 * touche pas.
 *
 * Cette règle existait en DEUX exemplaires : le moteur de créneaux
 * (`scheduling.service.ts`) et le calcul de prochaine disponibilité côté
 * Cloud Functions. Le second n'a jamais lu que `allDay` — une fermeture
 * horaire n'y comptait pour rien, et `nextAvailableSlot` annonçait
 * disponible un jour entièrement bloqué. Le moteur, lui, refusait bien la
 * réservation : impossible de réserver pour de vrai, mais l'indicateur
 * mentait, ce qui est le pire des deux mondes pour la cliente qui s'y fie.
 *
 * D'où l'extraction ici, à côté du validateur de saisie qui partage
 * exactement le même vocabulaire. `functions` ne pouvant pas importer ce
 * paquet, il en garde un miroir — mais un miroir d'une source unique et
 * testée, plus d'une seconde interprétation écrite de mémoire.
 *
 * Les quatre lectures d'un blocage horaire multi-jours :
 *
 *  - `'daily'` : la même tranche chaque jour, telle quelle ;
 *  - premier jour d'une absence continue : du début jusqu'à minuit ;
 *  - dernier jour : de minuit jusqu'à la fin ;
 *  - jour intercalaire : la journée entière.
 */
export function blockedWindowForDay(
  periode: BlockedPeriodShape,
  jour: Date
): BlockedWindow | null {
  const cible = auMinuit(jour);
  const premierJour = auMinuit(periode.startDate);
  const dernierJour = auMinuit(periode.endDate);

  if (cible < premierJour || cible > dernierJour) return null;
  if (periode.allDay) return { startMin: 0, endMin: MINUTES_PAR_JOUR };
  if (!periode.startTime || !periode.endTime) return null;

  const estPremier = cible.getTime() === premierJour.getTime();
  const estDernier = cible.getTime() === dernierJour.getTime();

  // Un seul jour, ou tranche répétée : la fenêtre saisie, telle quelle.
  if ((estPremier && estDernier) || periode.spanMode === 'daily') {
    return {
      startMin: hhmmToMinutes(periode.startTime),
      endMin: endHhmmToMinutes(periode.endTime),
    };
  }
  if (estPremier) {
    return { startMin: hhmmToMinutes(periode.startTime), endMin: MINUTES_PAR_JOUR };
  }
  if (estDernier) {
    return { startMin: 0, endMin: endHhmmToMinutes(periode.endTime) };
  }
  return { startMin: 0, endMin: MINUTES_PAR_JOUR };
}
