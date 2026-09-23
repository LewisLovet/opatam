/**
 * « Peut-on notifier cette personne maintenant ? »
 *
 * ── Pourquoi cette règle vit dans son propre fichier ────────────────────
 * Elle était écrite en dur dans le cron de rappels, et évaluée À PARIS
 * pour tout le monde : `if (heureParis >= 23 || heureParis < 6) return;`.
 *
 * Le cron s'arrêtait donc ENTIÈREMENT la nuit métropolitaine. Or un
 * rendez-vous à 8 h à La Réunion demande son rappel « 2 h avant » à 6 h
 * locales, soit 3 h du matin à Paris. Ce rappel ne partait pas « en
 * retard » : il ne partait JAMAIS, et le salon perdait silencieusement
 * tous ses rappels matinaux.
 *
 * La règle se juge maintenant CHEZ LE DESTINATAIRE, réservation par
 * réservation. Extraite ici pour être testable : son échec ne produit
 * aucune erreur, juste des messages qui n'arrivent pas.
 */

/** Début et fin des heures silencieuses, en heures locales. */
export const SILENCE_DEBUT = 23;
export const SILENCE_FIN = 6;

/**
 * L'heure locale (0–23) d'un instant dans un fuseau.
 *
 * `Intl` plutôt qu'un reparsage de `toLocaleString` : la seconde forme
 * reconstruit une Date dans le fuseau de la MACHINE, ce qui remettrait
 * exactement le bug qu'on corrige.
 */
export function heureLocaleDe(instant: Date, fuseau: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(instant),
  );
}

/**
 * Est-on dans les heures silencieuses chez ce destinataire ?
 *
 * `fuseau` vide ou inconnu → Europe/Paris, c'est-à-dire le comportement
 * d'avant. On ne devine pas, on retombe sur l'existant.
 */
export function estHeureSilencieuse(instant: Date, fuseau?: string | null): boolean {
  let heure: number;
  try {
    heure = heureLocaleDe(instant, fuseau || 'Europe/Paris');
  } catch {
    // Un fuseau invalide en base ne doit pas faire taire les rappels de
    // tout le monde : on retombe sur Paris.
    heure = heureLocaleDe(instant, 'Europe/Paris');
  }
  return heure >= SILENCE_DEBUT || heure < SILENCE_FIN;
}
