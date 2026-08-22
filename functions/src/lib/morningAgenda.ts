/**
 * Décision d'envoi du résumé du matin — fonction PURE, testable sans
 * Firestore ni horloge réelle.
 *
 * POURQUOI ELLE EXISTE. La première version planifiait le cron à 8 h
 * Europe/Paris et formatait l'heure du premier rendez-vous dans ce même
 * fuseau. Un prestataire portugais le recevait donc à 7 h, avec une heure
 * d'avance sur l'horaire annoncé — un résumé de journée qui se trompe d'heure
 * est pire que pas de résumé.
 *
 * Le cron tourne désormais TOUTES LES HEURES et n'envoie à un prestataire que
 * lorsqu'il est 8 h CHEZ LUI. Le marqueur `morningAgendaSentOn` (date locale)
 * garantit un envoi par jour et par prestataire.
 */

/** Heure locale d'envoi. */
export const MORNING_HOUR = 8;

/**
 * Fuseau par pays. Le champ `provider.settings.timezone` n'est PAS utilisé :
 * aucune interface ne l'écrit, il vaut la valeur d'amorçage « Europe/Paris »
 * sur les 59 prestataires — portugais compris. S'y fier revenait exactement à
 * produire le bug. Le pays vient du lieu du prestataire, donc de la réalité.
 *
 * Des neuf pays desservis, seul le Portugal n'est pas sur l'heure d'Europe
 * centrale ; les autres partagent le même fuseau que Paris.
 */
const COUNTRY_TIMEZONES: Record<string, string> = {
  FR: 'Europe/Paris',
  BE: 'Europe/Brussels',
  LU: 'Europe/Luxembourg',
  CH: 'Europe/Zurich',
  DE: 'Europe/Berlin',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  PT: 'Europe/Lisbon',
};

export function providerTimeZone(countryCode: string | null | undefined): string {
  return COUNTRY_TIMEZONES[(countryCode ?? '').toUpperCase()] ?? 'Europe/Paris';
}

/** Date locale au format YYYY-MM-DD dans le fuseau donné. */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** Heure locale (0-23) dans le fuseau donné. */
export function localHour(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date),
  );
}

/** HH:MM local, tel qu'il sera lu par le prestataire. */
export function localTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone });
}

export interface MorningAgendaInput {
  now: Date;
  /** `settings.notificationPreferences.dailyAgendaPush` — ABSENT = activé.
   *  Lu ici plutôt que dans l'envoi : sans ça, un prestataire ayant coupé le
   *  résumé se voyait quand même poser le marqueur du jour (aucun push, mais
   *  une écriture inutile et un état trompeur). */
  enabled: boolean;
  /** Fuseau du prestataire, via `providerTimeZone(countryCode)`. */
  timeZone: string;
  /** `provider.morningAgendaSentOn` — date locale du dernier envoi. */
  lastSentOn: string | null | undefined;
  /** Toutes les réservations du prestataire dans la fenêtre interrogée. */
  bookingTimes: Date[];
}

export type MorningAgendaDecision =
  | { send: false; reason: 'desactive' | 'pas-l-heure' | 'deja-envoye' | 'aucun-rdv' }
  | { send: true; today: string; count: number; firstTime: string };

export function decideMorningAgenda(input: MorningAgendaInput): MorningAgendaDecision {
  const { now, timeZone, lastSentOn, bookingTimes, enabled } = input;

  if (!enabled) return { send: false, reason: 'desactive' };
  if (localHour(now, timeZone) !== MORNING_HOUR) return { send: false, reason: 'pas-l-heure' };

  const today = localDate(now, timeZone);
  if (lastSentOn === today) return { send: false, reason: 'deja-envoye' };

  // « Aujourd'hui » se juge dans le fuseau du prestataire : une réservation à
  // 00 h 30 à Lisbonne est encore la veille à Paris.
  const dujour = bookingTimes
    .filter((d) => localDate(d, timeZone) === today)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dujour.length === 0) return { send: false, reason: 'aucun-rdv' };

  return {
    send: true,
    today,
    count: dujour.length,
    firstTime: localTime(dujour[0], timeZone),
  };
}
