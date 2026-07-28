/**
 * Géométrie des plages de travail — pur, sans dépendance.
 *
 * Isolé du hook `useWorkingRanges` (qui, lui, parle à Firestore) pour être
 * testable seul : c'est ici que vit la logique susceptible de se tromper —
 * fusion des plages, complément sur une fenêtre — et elle est partagée par
 * la vue jour et la vue semaine du planning pro. Une copie par vue aurait
 * fini par diverger.
 *
 * Toutes les bornes sont en MINUTES depuis minuit, `start` inclus et `end`
 * exclu.
 */

export interface WorkingRange {
  start: number;
  end: number;
}

/** dayOfWeek JS (0 = dimanche) → plages fusionnées. */
export type RangesByDay = Record<number, WorkingRange[]>;

/** Fusionne les plages qui se chevauchent ou se touchent. */
export function mergeRanges(ranges: WorkingRange[]): WorkingRange[] {
  if (ranges.length <= 1) return ranges.map((r) => ({ ...r }));
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: WorkingRange[] = [{ ...sorted[0] }];
  for (const r of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/**
 * Tranches FERMÉES d'une fenêtre : le complément des plages de travail.
 *
 * Une liste vide renvoie la fenêtre entière — un jour de fermeture doit se
 * voir en entier, c'est l'information la plus utile du planning.
 */
export function closedBands(
  ranges: WorkingRange[],
  windowStart: number,
  windowEnd: number,
): WorkingRange[] {
  if (windowEnd <= windowStart) return [];
  const out: WorkingRange[] = [];
  let cursor = windowStart;
  for (const r of mergeRanges(ranges)) {
    const start = Math.max(r.start, windowStart);
    const end = Math.min(r.end, windowEnd);
    if (end <= start) continue;
    if (start > cursor) out.push({ start: cursor, end: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < windowEnd) out.push({ start: cursor, end: windowEnd });
  return out;
}
