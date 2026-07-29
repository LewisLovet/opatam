/**
 * Flux d'abonnement iCalendar du planning d'un prestataire.
 *
 * Le pro s'abonne UNE fois à une URL secrète depuis son agenda (Apple
 * Calendar, Google Agenda, Outlook). L'agenda re-consulte cette URL tout
 * seul : une nouvelle réservation apparaît, une annulation disparaît, un
 * déplacement bouge. Aucun OAuth, aucun jeton à renouveler, aucun module
 * natif — c'est du texte servi en HTTP.
 *
 * L'URL EST UNE CLÉ. Quiconque l'a voit tout le planning et le nom des
 * clientes. D'où un jeton long et aléatoire, régénérable en un geste
 * (l'ancien cesse alors de fonctionner), et jamais envoyé par email.
 *
 * Le flux est en LECTURE SEULE côté agenda : le pro ne peut pas déplacer
 * un RDV depuis Apple Calendar. C'est volontaire — ça évite toute la
 * question « il a effacé l'événement, faut-il annuler la cliente ? ».
 */

import { randomBytes } from 'crypto';

/** Fenêtre servie : un mois en arrière, un an en avant. Assez pour que le
 *  pro garde un historique consultable, assez court pour que le fichier
 *  reste léger — les agendas retéléchargent tout à chaque rafraîchissement. */
export const FEED_PAST_DAYS = 30;
export const FEED_FUTURE_DAYS = 365;

export function generateFeedToken(): string {
  return randomBytes(24).toString('hex');
}

/** Horodatage iCalendar en UTC (RFC 5545). */
export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Échappement RFC 5545 : antislash d'abord, sinon on ré-échappe le reste. */
export function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Repli les lignes à 75 octets comme l'exige la RFC 5545.
 *
 * Sans ça, un nom de cliente un peu long produit une ligne trop longue —
 * tolérée par la plupart des agendas, refusée par certains, et Apple fait
 * partie des stricts sur les gros fichiers.
 */
export function foldIcsLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let current = '';
  for (const char of line) {
    const candidate = current + char;
    // 74 pour laisser la place à l'espace de continuation.
    if (Buffer.byteLength(candidate, 'utf8') > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join('\r\n');
}

export interface FeedEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
}

export function buildIcsFeed(calendarName: string, events: FeedEvent[]): string {
  const stamp = formatIcsDate(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Opatam//Planning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // Nom affiché de l'agenda. X-WR-CALNAME est non standard mais c'est
    // ce que lisent Apple Calendar et Google ; sans lui l'abonnement
    // s'appelle par son URL, ce qui est illisible.
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    // Indication de rafraîchissement. Les agendas restent libres de
    // l'ignorer — le délai réel appartient au réglage de l'abonné.
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(event.start)}`,
      `DTEND:${formatIcsDate(event.end)}`,
      `SUMMARY:${escapeIcs(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    lines.push('STATUS:CONFIRMED', 'END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n');
}
