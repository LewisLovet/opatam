/**
 * Met en mots la restriction de jours d'une prestation.
 *
 * La règle de bascule : au-delà de quatre jours ouverts, on énonce ce qui est
 * FERMÉ plutôt que ce qui est ouvert. « Lundi, mardi, mercredi, jeudi,
 * vendredi et samedi uniquement » est illisible là où « sauf le dimanche »
 * se comprend d'un regard — et c'est la même information.
 */
export interface DayPhrase {
  /** Clé i18n à utiliser : forme positive ou négative. */
  key: 'only' | 'except';
  /** Jours à énumérer, dans l'ordre de lecture d'une semaine. */
  days: number[];
}

/** Ordre de lecture : lundi d'abord, dimanche en dernier. */
const READING_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** `null` quand la prestation n'a aucune restriction — rien à dire. */
export function describeServiceDays(availableDays: number[] | undefined): DayPhrase | null {
  if (!availableDays || availableDays.length === 0 || availableDays.length === 7) {
    return null;
  }
  const open = READING_ORDER.filter((d) => availableDays.includes(d));
  if (open.length <= 4) return { key: 'only', days: open };
  return { key: 'except', days: READING_ORDER.filter((d) => !availableDays.includes(d)) };
}

/**
 * Assemble une liste de jours en énumération lisible : « le lundi, le mardi
 * et le jeudi ». Le dernier séparateur est un « et » — une virgule y ferait
 * lire une liste tronquée.
 */
export function joinDays(days: number[], label: (d: number) => string, and: string): string {
  const parts = days.map(label);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}
