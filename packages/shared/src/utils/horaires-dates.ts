/**
 * Horaires d'un membre JOUR PAR JOUR — la seule règle.
 *
 * Trois couches, de la plus générale à la plus précise :
 *   1. la semaine type (`availability`, un document par jour de la semaine,
 *      avec d'éventuels changements programmés `effectiveFrom`) ;
 *   2. l'option « horaires variables » du membre : la semaine type ne
 *      s'applique plus, un jour sans réglage daté est FERMÉ ;
 *   3. les horaires datés (`datedAvailability`) : sur une période, et
 *      éventuellement certains jours de la semaine, des plages, « fermé »,
 *      ou « horaires habituels ». Le réglage le plus RÉCENT qui couvre un
 *      jour l'emporte — on repeint par-dessus.
 *
 * Tout ce qui lit des horaires (moteur de créneaux, prochaine disponibilité,
 * page publique, widget, écran du salon, voile de l'agenda) passe par
 * `horairesDuJour` : sinon la page dirait « ouvert » un jour où le moteur ne
 * propose rien. Pur, sans import d'exécution : testé par
 * `horaires-dates.node.test.mjs`.
 */
import type { DatedAvailabilityMode, TimeSlot } from '../types';
import { horaireEnVigueurLe } from './horaires';

export interface HoraireSemaineLu {
  dayOfWeek: number;
  isOpen: boolean;
  slots?: TimeSlot[] | null;
  effectiveFrom?: Date | null;
}

export interface HoraireDateLu {
  from: string;
  to: string;
  weekdays?: number[] | null;
  mode: DatedAvailabilityMode;
  slots?: TimeSlot[] | null;
  /** Départage des réglages qui se recouvrent : le plus récent gagne. */
  createdAt: Date | number | null | undefined;
}

export interface HorairesDuJour {
  ouvert: boolean;
  plages: TimeSlot[];
  /** D'où viennent ces horaires : utile à l'affichage (« personnalisé »). */
  source: 'semaine' | 'date' | 'variables';
}

const instant = (c: HoraireDateLu['createdAt']) => (c instanceof Date ? c.getTime() : typeof c === 'number' ? c : 0);

/** Le réglage daté qui s'applique ce jour-là, ou `null`. */
export function reglageDateDuJour<T extends HoraireDateLu>(dates: readonly T[], jour: string, jourSemaine: number): T | null {
  let retenu: T | null = null;
  for (const d of dates) {
    if (d.from > jour || d.to < jour) continue;
    if (d.weekdays && d.weekdays.length > 0 && !d.weekdays.includes(jourSemaine)) continue;
    // À égalité (même instant), le dernier de la liste : ordre d'écriture.
    if (!retenu || instant(d.createdAt) >= instant(retenu.createdAt)) retenu = d;
  }
  return retenu;
}

/**
 * Les horaires d'un membre un jour donné (`jour` = « 2026-10-06 », date
 * calendaire du LIEU ; `jourSemaine` = son `getDay`).
 */
export function horairesDuJour(p: {
  jour: string;
  jourSemaine: number;
  semaine: readonly HoraireSemaineLu[];
  dates: readonly HoraireDateLu[];
  horairesVariables?: boolean | null;
  /** Date d'effet d'un changement programmé → date calendaire du lieu. */
  jourDEffet: (d: Date) => string;
}): HorairesDuJour {
  const date = reglageDateDuJour(p.dates, p.jour, p.jourSemaine);
  if (date && date.mode === 'slots') {
    const plages = [...(date.slots ?? [])];
    return { ouvert: plages.length > 0, plages, source: 'date' };
  }
  if (date && date.mode === 'closed') return { ouvert: false, plages: [], source: 'date' };
  // Aucun réglage, ou « horaires habituels » : ce qui s'applique sans réglage.
  if (p.horairesVariables) return { ouvert: false, plages: [], source: 'variables' };
  const semaine = horaireEnVigueurLe(p.semaine, p.jourSemaine, p.jour, p.jourDEffet);
  const plages = semaine?.isOpen ? [...(semaine.slots ?? [])] : [];
  return { ouvert: plages.length > 0, plages, source: 'semaine' };
}

// ── Validation d'un réglage ────────────────────────────────────────────────

/** Une période ne dépasse pas un an (même borne que les répétitions). */
export const DUREE_MAX_HORAIRES_DATES_JOURS = 366;

export type RaisonHorairesDatesInvalides =
  | 'dates'
  | 'ordre'
  | 'duree'
  | 'jours'
  | 'mode'
  | 'aucunePlage'
  | 'plage'
  | 'chevauchement';

export const MESSAGES_HORAIRES_DATES: Record<RaisonHorairesDatesInvalides, string> = {
  dates: 'Dates invalides',
  ordre: 'La fin de la période doit être après son début',
  duree: 'Une période ne peut pas dépasser un an',
  jours: 'Jours de la semaine invalides',
  mode: 'Réglage invalide',
  aucunePlage: 'Ajoutez au moins une plage horaire, ou choisissez « Fermé »',
  plage: 'Une plage doit commencer avant de finir (HH:MM)',
  chevauchement: 'Les plages ne peuvent pas se chevaucher',
};

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const joursEntre = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);

/** Pourquoi ce réglage est irrecevable — un code, que chaque surface traduit. */
export function raisonHorairesDatesInvalides(r: {
  from: string;
  to: string;
  weekdays?: number[] | null;
  mode: string;
  slots?: TimeSlot[] | null;
}): RaisonHorairesDatesInvalides | null {
  if (!JOUR.test(r.from) || !JOUR.test(r.to)) return 'dates';
  if (r.to < r.from) return 'ordre';
  if (joursEntre(r.from, r.to) >= DUREE_MAX_HORAIRES_DATES_JOURS) return 'duree';
  if (r.weekdays && r.weekdays.some((j) => !Number.isInteger(j) || j < 0 || j > 6)) return 'jours';
  if (r.mode !== 'slots' && r.mode !== 'closed' && r.mode !== 'usual') return 'mode';
  if (r.mode !== 'slots') return null;
  const plages = r.slots ?? [];
  if (plages.length === 0) return 'aucunePlage';
  for (const pl of plages) {
    if (!HEURE.test(pl.start) || !HEURE.test(pl.end) || minutes(pl.start) >= minutes(pl.end)) return 'plage';
  }
  const triees = [...plages].sort((a, b) => minutes(a.start) - minutes(b.start));
  for (let i = 1; i < triees.length; i++) {
    if (minutes(triees[i].start) < minutes(triees[i - 1].end)) return 'chevauchement';
  }
  return null;
}

// ── Copier une semaine sur les suivantes ───────────────────────────────────

export interface ReglageACreer {
  from: string;
  to: string;
  weekdays: number[];
  mode: DatedAvailabilityMode;
  slots: TimeSlot[];
}

const cleJour = (h: HorairesDuJour) =>
  h.ouvert ? h.plages.map((p) => `${p.start}-${p.end}`).join(',') : 'ferme';

/**
 * « Copier cette semaine sur les N suivantes ». `semaineSource` : les 7
 * jours de la semaine copiée, du lundi au dimanche, TELS QU'ILS
 * S'APPLIQUENT (résolus par `horairesDuJour`). `lundiCible` : le lundi de la
 * première semaine visée.
 *
 * Les jours aux horaires identiques sont regroupés en UN réglage couvrant
 * toute la période visée : au plus 7 réglages, quelle que soit sa durée —
 * et le résultat se relit comme une semaine, pas comme 7 × N documents.
 */
export function copierSemaine(
  semaineSource: readonly HorairesDuJour[],
  lundiCible: string,
  nombreDeSemaines: number,
  ajouterJours: (jour: string, n: number) => string,
): ReglageACreer[] {
  if (semaineSource.length !== 7) throw new Error('Une semaine source compte 7 jours, du lundi au dimanche');
  if (!Number.isInteger(nombreDeSemaines) || nombreDeSemaines < 1) throw new Error('Nombre de semaines invalide');
  const fin = ajouterJours(lundiCible, nombreDeSemaines * 7 - 1);
  const groupes = new Map<string, { jours: number[]; h: HorairesDuJour }>();
  semaineSource.forEach((h, i) => {
    const jourSemaine = (i + 1) % 7; // index 0 = lundi → getDay 1 ; 6 = dimanche → 0
    const cle = cleJour(h);
    const g = groupes.get(cle) ?? { jours: [], h };
    g.jours.push(jourSemaine);
    groupes.set(cle, g);
  });
  return [...groupes.values()].map(({ jours, h }) => ({
    from: lundiCible,
    to: fin,
    weekdays: jours.sort((a, b) => a - b),
    mode: h.ouvert ? 'slots' : 'closed',
    slots: h.ouvert ? h.plages.map((p) => ({ start: p.start, end: p.end })) : [],
  }));
}

// ── Ménage : les réglages entièrement repeints ─────────────────────────────

const jourSemaineDe = (jour: string) => new Date(Date.UTC(+jour.slice(0, 4), +jour.slice(5, 7) - 1, +jour.slice(8, 10))).getUTCDay();

/** Les jours de la semaine qu'un réglage touche RÉELLEMENT (une période de 3 jours n'en touche que 3). */
function joursTouches(r: { from: string; to: string; weekdays?: number[] | null }): number[] {
  const span = joursEntre(r.from, r.to) + 1;
  const presents = new Set<number>();
  const premier = jourSemaineDe(r.from);
  for (let i = 0; i < Math.min(span, 7); i++) presents.add((premier + i) % 7);
  const choisis = r.weekdays && r.weekdays.length > 0 ? r.weekdays : [0, 1, 2, 3, 4, 5, 6];
  return choisis.filter((j) => presents.has(j));
}

/**
 * Les réglages existants que les NOUVEAUX recouvrent entièrement — chacun
 * de leurs jours est repeint par un réglage plus récent : ils ne comptent
 * plus pour rien. Les supprimer dans le même lot garde la collection lisible
 * (retoucher dix fois le même jour ne laisse qu'un réglage) sans changer
 * aucun horaire.
 */
export function reglagesRecouverts<T extends { id: string; from: string; to: string; weekdays?: number[] | null }>(
  existants: readonly T[],
  nouveaux: readonly { from: string; to: string; weekdays?: number[] | null }[],
): string[] {
  return existants
    .filter((e) =>
      joursTouches(e).every((j) =>
        nouveaux.some(
          (n) => n.from <= e.from && n.to >= e.to && (!n.weekdays || n.weekdays.length === 0 || n.weekdays.includes(j)),
        ),
      ),
    )
    .map((e) => e.id);
}

/** Le lundi de la semaine d'un jour (« 2026-10-08 » → « 2026-10-05 »). */
export function lundiDe(jour: string, ajouterJours: (jour: string, n: number) => string): string {
  return ajouterJours(jour, -((jourSemaineDe(jour) + 6) % 7));
}

// ── Toute une équipe, sur une plage de jours ───────────────────────────────

/**
 * Les horaires de TOUTE une équipe, jour par jour : les documents lus une
 * fois (semaine type, horaires datés, option « horaires variables » par
 * membre), la fonction rendue répond pour (membre, jour). Pour les écrans
 * qui montrent plusieurs membres ou plusieurs jours : agenda, écran du
 * salon, widget, page publique.
 */
export function lecteurHorairesEquipe(p: {
  semaine: readonly (HoraireSemaineLu & { memberId: string })[];
  dates: readonly (HoraireDateLu & { memberId: string })[];
  /** Les membres dont la semaine type ne s'applique pas. */
  membresVariables: Iterable<string>;
  jourDEffet: (d: Date) => string;
}): (memberId: string, jour: string) => HorairesDuJour {
  const semaineDe = new Map<string, HoraireSemaineLu[]>();
  for (const d of p.semaine) semaineDe.set(d.memberId, [...(semaineDe.get(d.memberId) ?? []), d]);
  const datesDe = new Map<string, HoraireDateLu[]>();
  for (const d of p.dates) datesDe.set(d.memberId, [...(datesDe.get(d.memberId) ?? []), d]);
  const variables = new Set(p.membresVariables);
  return (memberId, jour) =>
    horairesDuJour({
      jour,
      jourSemaine: jourSemaineDe(jour),
      semaine: semaineDe.get(memberId) ?? [],
      dates: datesDe.get(memberId) ?? [],
      horairesVariables: variables.has(memberId),
      jourDEffet: p.jourDEffet,
    });
}
