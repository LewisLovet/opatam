/**
 * Notifications de l'ESPACE MEMBRE — les décisions et les textes, purs et
 * testés (`notificationsMembre.node.test.mjs`).
 *
 * Un membre (compte de l'app relié à `memberAccounts/{uid}`) reçoit ce qui
 * concerne SES rendez-vous : nouveau, annulé, déplacé, dans une heure, sa
 * journée le matin, un avis reçu. Jamais ce qu'il vient de faire lui-même.
 *
 * Le gérant garde tout par défaut ; un interrupteur « Rendez-vous de
 * l'équipe » (`teamBookingNotifications`, absent = activé) lui permet de ne
 * plus recevoir que les siens.
 */
import type { ProviderLocale } from './providerPushI18n';

/** Les familles de notifications qu'un membre peut couper. */
export type TypeNotifMembre = 'rendezVous' | 'rappels' | 'resumeDuMatin' | 'avis';

/** `users/{uid}.notificationSettings.espaceMembre` — absent = activé. */
export function notifMembreActivee(reglages: unknown, type: TypeNotifMembre): boolean {
  const r = (reglages as { espaceMembre?: Record<string, unknown> } | null | undefined)?.espaceMembre;
  return r?.[type] !== false;
}

/**
 * Qui, côté pro, est l'auteur de CETTE écriture du rendez-vous ? Le service
 * pose `proActor` (+ `proActorAt`) dans la même écriture que le
 * changement : si l'horodatage a bougé, l'action vient du pro ; sinon elle
 * vient d'ailleurs (la cliente, un traitement serveur).
 */
export function acteurDeLEcriture(
  avant: { proActor?: unknown; proActorAt?: unknown } | null | undefined,
  apres: { proActor?: unknown; proActorAt?: unknown } | null | undefined,
): 'owner' | 'member' | null {
  if (!apres) return null;
  const acteur = apres.proActor === 'owner' || apres.proActor === 'member' ? apres.proActor : null;
  if (!acteur) return null;
  if (!avant) return acteur; // création : posé avec le document
  const instant = (v: unknown) =>
    v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis(): number }).toMillis() : v instanceof Date ? v.getTime() : null;
  const a = instant(avant.proActorAt);
  const b = instant(apres.proActorAt);
  return b !== null && a !== b ? acteur : null;
}

/** Le membre est-il prévenu ? Jamais de sa propre action. */
export function membrePrevenu(acteur: 'owner' | 'member' | null): boolean {
  return acteur !== 'member';
}

/**
 * Le gérant est-il prévenu d'un rendez-vous ? Toujours pour les siens ;
 * pour ceux de l'équipe, sauf s'il a coupé « Rendez-vous de l'équipe ».
 */
export function gerantPrevenu(p: { rdvDuGerant: boolean; preferences: unknown }): boolean {
  if (p.rdvDuGerant) return true;
  return (p.preferences as { teamBookingNotifications?: unknown } | null | undefined)?.teamBookingNotifications !== false;
}

// ── Textes (ce qui n'existe pas déjà dans PUSH_TEXTS) ──────────────────────

type Textes = {
  annuleParSalon: (nom: string, date: string) => string;
  rdvDeplace: string;
  deplaceVers: (nom: string, prestation: string, date: string) => string;
  nouvelAvis: string;
  avisCorps: (nom: string, note: number, extrait: string | null) => string;
  /** Récapitulatif au gérant : un membre a modifié son planning. */
  planningModifie: (nom: string) => string;
  planningModifieCorps: (n: number) => string;
};

export const TEXTES_MEMBRE: Record<ProviderLocale, Textes> = {
  fr: {
    annuleParSalon: (nom, d) => `Le rendez-vous de ${nom} du ${d} a été annulé par le salon`,
    rdvDeplace: 'Rendez-vous déplacé',
    deplaceVers: (nom, p, d) => `${nom} · ${p} : désormais le ${d}`,
    nouvelAvis: 'Nouvel avis',
    avisCorps: (nom, n, e) => (e ? `${nom} vous a donné ${n}/5 : « ${e} »` : `${nom} vous a donné ${n}/5`),
    planningModifie: (nom) => `${nom} a modifié son planning`,
    planningModifieCorps: (n) => (n > 1 ? `${n} changements (horaires ou indisponibilités). Touchez pour voir.` : `1 changement (horaires ou indisponibilités). Touchez pour voir.`),
  },
  en: {
    annuleParSalon: (nom, d) => `${nom}'s booking on ${d} was cancelled by the salon`,
    rdvDeplace: 'Booking moved',
    deplaceVers: (nom, p, d) => `${nom} · ${p}: now on ${d}`,
    nouvelAvis: 'New review',
    avisCorps: (nom, n, e) => (e ? `${nom} gave you ${n}/5: “${e}”` : `${nom} gave you ${n}/5`),
    planningModifie: (nom) => `${nom} changed their schedule`,
    planningModifieCorps: (n) => (n > 1 ? `${n} changes (hours or time off). Tap to see.` : `1 change (hours or time off). Tap to see.`),
  },
  it: {
    annuleParSalon: (nom, d) => `L'appuntamento di ${nom} del ${d} è stato annullato dal salone`,
    rdvDeplace: 'Appuntamento spostato',
    deplaceVers: (nom, p, d) => `${nom} · ${p}: ora il ${d}`,
    nouvelAvis: 'Nuova recensione',
    avisCorps: (nom, n, e) => (e ? `${nom} ti ha dato ${n}/5: «${e}»` : `${nom} ti ha dato ${n}/5`),
    planningModifie: (nom) => `${nom} ha modificato il suo planning`,
    planningModifieCorps: (n) => (n > 1 ? `${n} modifiche (orari o indisponibilità). Tocca per vedere.` : `1 modifica (orari o indisponibilità). Tocca per vedere.`),
  },
  pt: {
    annuleParSalon: (nom, d) => `A marcação de ${nom} de ${d} foi cancelada pelo salão`,
    rdvDeplace: 'Marcação alterada',
    deplaceVers: (nom, p, d) => `${nom} · ${p}: agora a ${d}`,
    nouvelAvis: 'Nova avaliação',
    avisCorps: (nom, n, e) => (e ? `${nom} deu-lhe ${n}/5: «${e}»` : `${nom} deu-lhe ${n}/5`),
    planningModifie: (nom) => `${nom} alterou os seus horários`,
    planningModifieCorps: (n) => (n > 1 ? `${n} alterações (horários ou indisponibilidades). Toque para ver.` : `1 alteração (horários ou indisponibilidades). Toque para ver.`),
  },
  de: {
    annuleParSalon: (nom, d) => `Der Termin von ${nom} am ${d} wurde vom Salon storniert`,
    rdvDeplace: 'Termin verschoben',
    deplaceVers: (nom, p, d) => `${nom} · ${p}: jetzt am ${d}`,
    nouvelAvis: 'Neue Bewertung',
    avisCorps: (nom, n, e) => (e ? `${nom} hat Ihnen ${n}/5 gegeben: „${e}“` : `${nom} hat Ihnen ${n}/5 gegeben`),
    planningModifie: (nom) => `${nom} hat den Dienstplan geändert`,
    planningModifieCorps: (n) => (n > 1 ? `${n} Änderungen (Zeiten oder Abwesenheiten). Tippen zum Ansehen.` : `1 Änderung (Zeiten oder Abwesenheiten). Tippen zum Ansehen.`),
  },
};

/** Extrait d'un commentaire, 80 caractères au plus. */
export function extrait(commentaire: string | null | undefined): string | null {
  const c = (commentaire ?? '').trim();
  if (!c) return null;
  return c.length > 80 ? `${c.slice(0, 80)}…` : c;
}
