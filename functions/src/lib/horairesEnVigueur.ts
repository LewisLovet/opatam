/**
 * Miroir de `horaireEnVigueurLe` (@booking-app/shared/utils/horaires) et de
 * `horairesDuJour` (@booking-app/shared/utils/horaires-dates) — les
 * functions n'importent pas le paquet partagé à l'exécution. Toute
 * correction faite là-bas doit être reportée ici : le test
 * `horaires-dates.node.test.mjs` confronte les deux.
 *
 * Les horaires d'UN jour de la semaine en vigueur LE jour `jour` (date
 * calendaire du lieu) : parmi les documents de ce jour de la semaine, celui
 * dont la date d'effet est la plus récente sans dépasser `jour` ; les
 * horaires de base (`effectiveFrom` nul) valent depuis toujours. Le calcul de
 * la prochaine disponibilité gardait le dernier document lu : un changement
 * programmé pour plus tard s'appliquait dès aujourd'hui.
 */
export function horaireEnVigueurLe<T extends { dayOfWeek: number; effectiveFrom?: Date | null }>(
  docs: readonly T[],
  jourSemaine: number,
  jour: string,
  jourDEffet: (d: Date) => string,
): T | null {
  let retenu: T | null = null;
  let effetRetenu = '';
  for (const d of docs) {
    if (d.dayOfWeek !== jourSemaine) continue;
    const effet = d.effectiveFrom ? jourDEffet(new Date(d.effectiveFrom)) : '';
    if (effet && effet > jour) continue;
    if (!retenu || effet >= effetRetenu) {
      retenu = d;
      effetRetenu = effet;
    }
  }
  return retenu;
}

interface Plage {
  start: string;
  end: string;
}

export interface HoraireSemaineLu {
  dayOfWeek: number;
  isOpen: boolean;
  slots?: Plage[] | null;
  effectiveFrom?: Date | null;
}

/** Un horaire DATÉ (`providers/{pid}/datedAvailability`). */
export interface HoraireDateLu {
  from: string;
  to: string;
  weekdays?: number[] | null;
  mode: 'slots' | 'closed' | 'usual';
  slots?: Plage[] | null;
  createdAt: Date | number | null | undefined;
}

const instant = (c: HoraireDateLu['createdAt']) => (c instanceof Date ? c.getTime() : typeof c === 'number' ? c : 0);

/** Le réglage daté qui s'applique ce jour-là (le plus récent), ou `null`. */
export function reglageDateDuJour<T extends HoraireDateLu>(dates: readonly T[], jour: string, jourSemaine: number): T | null {
  let retenu: T | null = null;
  for (const d of dates) {
    if (d.from > jour || d.to < jour) continue;
    if (d.weekdays && d.weekdays.length > 0 && !d.weekdays.includes(jourSemaine)) continue;
    if (!retenu || instant(d.createdAt) >= instant(retenu.createdAt)) retenu = d;
  }
  return retenu;
}

/**
 * Les horaires d'un membre un jour donné : horaire daté s'il y en a un,
 * sinon (ou « horaires habituels ») fermé pour un membre en « horaires
 * variables », sinon la semaine type en vigueur.
 */
export function horairesDuJour(p: {
  jour: string;
  jourSemaine: number;
  semaine: readonly HoraireSemaineLu[];
  dates: readonly HoraireDateLu[];
  horairesVariables?: boolean | null;
  jourDEffet: (d: Date) => string;
}): { ouvert: boolean; plages: Plage[]; source: 'semaine' | 'date' | 'variables' } {
  const date = reglageDateDuJour(p.dates, p.jour, p.jourSemaine);
  if (date && date.mode === 'slots') {
    const plages = [...(date.slots ?? [])];
    return { ouvert: plages.length > 0, plages, source: 'date' };
  }
  if (date && date.mode === 'closed') return { ouvert: false, plages: [], source: 'date' };
  if (p.horairesVariables) return { ouvert: false, plages: [], source: 'variables' };
  const semaine = horaireEnVigueurLe(p.semaine, p.jourSemaine, p.jour, p.jourDEffet);
  const plages = semaine?.isOpen ? [...(semaine.slots ?? [])] : [];
  return { ouvert: plages.length > 0, plages, source: 'semaine' };
}
