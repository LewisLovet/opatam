/**
 * Rappel « votre semaine prochaine est vide » — la décision, pure et testée
 * (`rappelPlanning.node.test.mjs`).
 *
 * POUR QUI. Les membres en HORAIRES VARIABLES seulement : sans semaine type,
 * une semaine sans aucun horaire daté n'est réservable par personne — c'est
 * presque toujours un oubli. Un membre à semaine type n'a une semaine fermée
 * que s'il l'a voulu (congés) : on ne le relance pas.
 *
 * QUAND. Le JEUDI à 18 h (heure du lieu), trois jours pour remplir ; puis le
 * DIMANCHE à 18 h si c'est toujours vide. Les deux visent la semaine qui
 * commence le lundi suivant.
 *
 * QUI. Le membre (s'il a un accès à l'app) et le gérant, en un récapitulatif
 * par salon.
 */
import { ajouterJours, jourLocal, jourSemaineCalendaire, minutesLocales } from './fuseaux';
import { horairesDuJour, type HoraireDateLu } from './horairesEnVigueur';
import type { ProviderLocale } from './providerPushI18n';

export const HEURE_DU_RAPPEL = 18;

export type MomentDuRappel = 'jeudi' | 'dimanche';

/** Le rappel à envoyer à cet instant dans ce fuseau, ou `null`. */
export function momentDuRappel(maintenant: Date, fuseau: string): MomentDuRappel | null {
  if (Math.floor(minutesLocales(maintenant, fuseau) / 60) !== HEURE_DU_RAPPEL) return null;
  const jourSemaine = jourSemaineCalendaire(jourLocal(maintenant, fuseau));
  if (jourSemaine === 4) return 'jeudi';
  if (jourSemaine === 0) return 'dimanche';
  return null;
}

/** Le lundi qui SUIT le jour donné (« 2026-10-01 », un jeudi → « 2026-10-05 »). */
export function lundiSuivant(jour: string): string {
  const js = jourSemaineCalendaire(jour);
  return ajouterJours(jour, js === 0 ? 1 : 8 - js);
}

/**
 * La semaine du `lundi` est-elle VIDE pour un membre en horaires variables ?
 * Mêmes règles que la réservation (`horairesDuJour`), semaine type ignorée.
 */
export function semaineVide(dates: readonly HoraireDateLu[], lundi: string): boolean {
  for (let i = 0; i < 7; i++) {
    const jour = ajouterJours(lundi, i);
    const h = horairesDuJour({
      jour,
      jourSemaine: jourSemaineCalendaire(jour),
      semaine: [],
      dates,
      horairesVariables: true,
      jourDEffet: () => jour,
    });
    if (h.ouvert) return false;
  }
  return true;
}

/** Identifiant du marqueur anti-doublon (`planningReminders/{id}`). */
export function cleDuRappel(providerId: string, destinataire: string, lundi: string, moment: MomentDuRappel): string {
  return `${providerId}_${destinataire}_${lundi}_${moment}`;
}

// ── Textes ─────────────────────────────────────────────────────────────────

type Textes = {
  membreTitre: (semaine: string, rappel: boolean) => string;
  membreCorps: (du: string, au: string) => string;
  gerantTitre: (n: number, semaine: string) => string;
  gerantCorps: (noms: string) => string;
};

export const TEXTES_RAPPEL: Record<ProviderLocale, Textes> = {
  fr: {
    membreTitre: (s, r) => (r ? `Rappel : votre semaine du ${s} est toujours vide` : `Votre semaine du ${s} est vide`),
    membreCorps: (du, au) => `Aucune disponibilité du ${du} au ${au} : personne ne peut réserver. Ouvrez vos jours dans « Mon planning ».`,
    gerantTitre: (n, s) => (n > 1 ? `${n} personnes n'ont rien ouvert pour la semaine du ${s}` : `Une personne n'a rien ouvert pour la semaine du ${s}`),
    gerantCorps: (noms) => `${noms} : aucune disponibilité, donc aucune réservation possible.`,
  },
  en: {
    membreTitre: (s, r) => (r ? `Reminder: your week of ${s} is still empty` : `Your week of ${s} is empty`),
    membreCorps: (du, au) => `No availability from ${du} to ${au}: nobody can book you. Open your days in “My schedule”.`,
    gerantTitre: (n, s) => (n > 1 ? `${n} people haven't opened anything for the week of ${s}` : `One person hasn't opened anything for the week of ${s}`),
    gerantCorps: (noms) => `${noms}: no availability, so no bookings possible.`,
  },
  it: {
    membreTitre: (s, r) => (r ? `Promemoria: la tua settimana del ${s} è ancora vuota` : `La tua settimana del ${s} è vuota`),
    membreCorps: (du, au) => `Nessuna disponibilità dal ${du} al ${au}: nessuno può prenotare. Apri i tuoi giorni in «Il mio planning».`,
    gerantTitre: (n, s) => (n > 1 ? `${n} persone non hanno aperto nulla per la settimana del ${s}` : `Una persona non ha aperto nulla per la settimana del ${s}`),
    gerantCorps: (noms) => `${noms}: nessuna disponibilità, quindi nessuna prenotazione possibile.`,
  },
  pt: {
    membreTitre: (s, r) => (r ? `Lembrete: a sua semana de ${s} continua vazia` : `A sua semana de ${s} está vazia`),
    membreCorps: (du, au) => `Sem disponibilidade de ${du} a ${au}: ninguém pode reservar. Abra os seus dias em «Os meus horários».`,
    gerantTitre: (n, s) => (n > 1 ? `${n} pessoas não abriram nada para a semana de ${s}` : `Uma pessoa não abriu nada para a semana de ${s}`),
    gerantCorps: (noms) => `${noms}: sem disponibilidade, logo sem reservas possíveis.`,
  },
  de: {
    membreTitre: (s, r) => (r ? `Erinnerung: Ihre Woche ab ${s} ist noch leer` : `Ihre Woche ab ${s} ist leer`),
    membreCorps: (du, au) => `Keine Verfügbarkeit vom ${du} bis ${au}: niemand kann buchen. Öffnen Sie Ihre Tage in „Mein Dienstplan“.`,
    gerantTitre: (n, s) => (n > 1 ? `${n} Personen haben für die Woche ab ${s} nichts geöffnet` : `Eine Person hat für die Woche ab ${s} nichts geöffnet`),
    gerantCorps: (noms) => `${noms}: keine Verfügbarkeit, also keine Buchung möglich.`,
  },
};

/** « 5 octobre » dans la langue du salon. */
export function jourLisible(jour: string, intl: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(a, m - 1, j)));
}
