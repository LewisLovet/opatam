/**
 * Journal des e-mails envoyés — pour les retrouver depuis l'admin.
 *
 * ── Pourquoi ─────────────────────────────────────────────────────────────
 * Le 24 septembre 2026, retrouver « les e-mails de tel rendez-vous » a
 * demandé de fouiller les logs Cloud Functions à la minute près : rien
 * n'était tracé en base, et l'identifiant Resend — le seul moyen de relire
 * un e-mail tel qu'envoyé — était jeté à la sortie de `emails.send`.
 *
 * Chaque envoi passe désormais par `envoyerEmail`, qui écrit un document
 * `emailLogs/{id}` : quoi (type), à qui, pour quelle réservation et quel
 * prestataire, ce que l'e-mail ANNONÇAIT (date, heure, fuseau), l'identifiant
 * Resend et le statut. L'admin liste ces documents par réservation et, avec
 * l'identifiant, relit le rendu exact auprès de Resend.
 *
 * ── Règles ───────────────────────────────────────────────────────────────
 *  - Le journal est BEST-EFFORT : un échec d'écriture ne fait jamais échouer
 *    un e-mail, et ne remonte pas. On préfère un e-mail parti sans trace à
 *    une trace sans e-mail.
 *  - On n'archive PAS le corps : Resend le garde, et la page de
 *    confirmation d'une cliente n'a rien à faire dupliquée en base. Le
 *    `resume` ne contient que ce qu'il faut pour répondre à « qu'est-ce
 *    qu'on lui a dit ? » sans relire l'e-mail.
 *  - Lecture réservée aux admins par les règles Firestore ; les Functions
 *    écrivent avec l'Admin SDK, qui les contourne.
 */

import * as admin from 'firebase-admin';
import type { Resend } from 'resend';

/** Ce que l'appelant sait de l'e-mail — tout est facultatif sauf le type. */
export interface JournalMeta {
  /** « confirmation », « reminder », « provider_new_booking »… */
  type: string;
  bookingId?: string | null;
  providerId?: string | null;
  clientId?: string | null;
  /** Langue de l'e-mail, quand elle est choisie. */
  locale?: string | null;
  /** Ce que l'e-mail annonce : date/heure du rendez-vous, fuseau… */
  resume?: Record<string, string | number | boolean | null> | null;
}

/** La charge utile minimale qu'on transmet à Resend. */
export interface ChargeEmail {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  [cle: string]: unknown;
}

export interface ResultatEnvoi {
  /** L'erreur Resend, telle quelle, pour que les appelants gardent leur logique. */
  error: { message?: string; name?: string } | null;
  /** L'identifiant Resend — la clé pour relire l'e-mail. */
  id: string | null;
}

/** Le document écrit dans `emailLogs`. Pur, donc testable. */
export function construireEntreeJournal(
  charge: ChargeEmail,
  meta: JournalMeta,
  resultat: ResultatEnvoi,
): Record<string, unknown> {
  const destinataires = Array.isArray(charge.to) ? charge.to : [charge.to];
  return {
    type: meta.type,
    to: destinataires,
    subject: charge.subject,
    bookingId: meta.bookingId ?? null,
    providerId: meta.providerId ?? null,
    clientId: meta.clientId ?? null,
    locale: meta.locale ?? null,
    resume: meta.resume ?? null,
    resendId: resultat.id,
    status: resultat.error ? 'failed' : 'sent',
    error: resultat.error ? String(resultat.error.message ?? resultat.error.name ?? 'erreur') : null,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Pioche dans une charge utile d'e-mail ce qui identifie le rendez-vous et
 * ce qu'il annonce. Les quatorze fonctions d'envoi ont chacune leur type de
 * données ; plutôt que quatorze extractions, une seule qui prend ce qui
 * existe et ignore le reste.
 */
export function metaDepuis(
  type: string,
  data: unknown,
  complement: Partial<JournalMeta> = {},
): JournalMeta {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const texte = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const date = d.datetime instanceof Date ? d.datetime : null;
  const fuseau = texte(d.timeZone) ?? 'Europe/Paris';
  const resume: JournalMeta['resume'] = {};
  if (date) {
    resume.datetime = date.toISOString();
    // Ce que l'e-mail a AFFICHÉ, dans son fuseau : c'est la question qu'on
    // se pose quand une cliente conteste une heure.
    resume.affiche = new Intl.DateTimeFormat('fr-FR', {
      timeZone: fuseau,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
    resume.timeZone = fuseau;
  }
  if (typeof d.duration === 'number') resume.duration = d.duration;
  if (texte(d.serviceName)) resume.serviceName = texte(d.serviceName);
  if (texte(d.providerName)) resume.providerName = texte(d.providerName);
  return {
    type,
    bookingId: texte(d.bookingId),
    providerId: texte(d.providerId),
    clientId: texte(d.clientId),
    locale: texte(d.locale),
    resume: Object.keys(resume).length ? resume : null,
    ...complement,
  };
}

/**
 * Envoie, puis journalise. Rend `{ error, id }` : les appelants qui
 * faisaient `const { error } = await resend.emails.send(...)` gardent
 * exactement leur logique d'erreur.
 */
export async function envoyerEmail(
  resend: Resend,
  charge: ChargeEmail,
  meta: JournalMeta,
): Promise<ResultatEnvoi> {
  let resultat: ResultatEnvoi;
  try {
    // `as never` : la charge est validée par les appelants existants ; le
    // typage de Resend exige `react` OU `html` OU `text`, ce qu'on ne peut
    // pas exprimer sans dupliquer ses unions.
    const reponse = await resend.emails.send(charge as never);
    resultat = { error: reponse.error ?? null, id: reponse.data?.id ?? null };
  } catch (e) {
    resultat = { error: { message: e instanceof Error ? e.message : String(e) }, id: null };
  }

  try {
    await admin.firestore().collection('emailLogs').add(construireEntreeJournal(charge, meta, resultat));
  } catch (e) {
    // Jamais bloquant : l'e-mail est parti (ou pas), le journal est un confort.
    console.warn('[emailJournal] écriture impossible :', e instanceof Error ? e.message : e);
  }

  return resultat;
}
