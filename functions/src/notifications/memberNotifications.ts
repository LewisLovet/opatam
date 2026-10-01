/**
 * Notifications PUSH au MEMBRE de l'équipe (espace membre de l'app), pour
 * SES rendez-vous. Les décisions vivent dans `lib/notificationsMembre.ts`.
 *
 * Un membre sans compte de l'app (pas de `memberAccounts` actif) ne reçoit
 * rien : il n'a nulle part où les recevoir.
 */
import * as admin from 'firebase-admin';
import { providerLocale, PUSH_TEXTS, INTL_LOCALE, type ProviderLocale } from '../lib/providerPushI18n';
import { providerTimeZone } from '../lib/morningAgenda';
import { notifMembreActivee, TEXTES_MEMBRE, extrait, type TypeNotifMembre } from '../lib/notificationsMembre';
import { sendPushNotifications } from '../utils/expoPushService';

export interface ContexteMembre {
  uid: string;
  jetons: string[];
  locale: ProviderLocale;
  t: (typeof PUSH_TEXTS)[ProviderLocale];
  tm: (typeof TEXTES_MEMBRE)[ProviderLocale];
  intl: string;
  timeZone: string;
  active: (type: TypeNotifMembre) => boolean;
}

/** Le compte de l'app du membre, ses jetons, sa langue (celle du salon) et ses réglages. */
export async function chargerContexteMembre(
  providerId: string,
  memberId: string | null | undefined,
): Promise<ContexteMembre | null> {
  if (!memberId) return null;
  try {
    const db = admin.firestore();
    const compte = await db
      .collection('memberAccounts')
      .where('providerId', '==', providerId)
      .where('memberId', '==', memberId)
      .where('active', '==', true)
      .limit(1)
      .get();
    const uid = compte.docs[0]?.id;
    if (!uid) return null;
    const [user, provider] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('providers').doc(providerId).get(),
    ]);
    const jetons: string[] = user.data()?.pushTokens ?? [];
    if (jetons.length === 0) return null;
    const p = provider.data() ?? {};
    const locale = providerLocale(p);
    const reglages = user.data()?.notificationSettings;
    return {
      uid,
      jetons,
      locale,
      t: PUSH_TEXTS[locale],
      tm: TEXTES_MEMBRE[locale],
      intl: INTL_LOCALE[locale],
      timeZone: providerTimeZone(p.countryCode),
      active: (type) => notifMembreActivee(reglages, type),
    };
  } catch (err) {
    console.error(`[membre] contexte ${providerId}/${memberId} :`, err);
    return null;
  }
}

/** Retire les jetons refusés par Expo (appareil désinstallé…). */
async function retirerJetonsInvalides(uid: string, invalides: string[]) {
  try {
    const ref = admin.firestore().collection('users').doc(uid);
    const actuels: string[] = (await ref.get()).data()?.pushTokens ?? [];
    const restants = actuels.filter((j) => !invalides.includes(j));
    if (restants.length !== actuels.length) await ref.update({ pushTokens: restants });
  } catch (err) {
    console.error(`[membre] jetons invalides ${uid} :`, err);
  }
}

async function envoyer(ctx: ContexteMembre, title: string, body: string, data: Record<string, unknown>) {
  const resultat = await sendPushNotifications(ctx.jetons, { title, body, data });
  if (resultat.invalidTokens.length > 0) await retirerJetonsInvalides(ctx.uid, resultat.invalidTokens);
  return resultat.sentCount > 0;
}

interface RdvMembre {
  providerId: string;
  memberId?: string | null;
  serviceName: string;
  datetime: admin.firestore.Timestamp;
  timezone?: string | null;
  clientInfo?: { name?: string } | null;
  deposit?: { amount: number; status: string } | null;
}

const dateLongue = (d: Date, ctx: ContexteMembre, fuseau?: string | null) =>
  d.toLocaleString(ctx.intl, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: fuseau || ctx.timeZone });

export async function notifierMembreNouveauRdv(rdv: RdvMembre, bookingId: string): Promise<void> {
  const ctx = await chargerContexteMembre(rdv.providerId, rdv.memberId);
  if (!ctx || !ctx.active('rendezVous')) return;
  const nom = rdv.clientInfo?.name || ctx.t.uneCliente;
  await envoyer(ctx, ctx.t.nouveauRdv, ctx.t.ligneRdv(nom, rdv.serviceName, dateLongue(rdv.datetime.toDate(), ctx, rdv.timezone)), {
    type: 'new_booking',
    bookingId,
  });
}

export async function notifierMembreRdvAnnule(rdv: RdvMembre, bookingId: string, parLeSalon: boolean): Promise<void> {
  const ctx = await chargerContexteMembre(rdv.providerId, rdv.memberId);
  if (!ctx || !ctx.active('rendezVous')) return;
  const nom = rdv.clientInfo?.name || ctx.t.uneCliente;
  const date = dateLongue(rdv.datetime.toDate(), ctx, rdv.timezone);
  await envoyer(ctx, ctx.t.rdvAnnule, parLeSalon ? ctx.tm.annuleParSalon(nom, date) : ctx.t.annuleParClient(nom, date), {
    type: 'booking_cancelled_by_client',
    bookingId,
  });
}

export async function notifierMembreRdvDeplace(rdv: RdvMembre, bookingId: string): Promise<void> {
  const ctx = await chargerContexteMembre(rdv.providerId, rdv.memberId);
  if (!ctx || !ctx.active('rendezVous')) return;
  const nom = rdv.clientInfo?.name || ctx.t.uneCliente;
  await envoyer(ctx, ctx.tm.rdvDeplace, ctx.tm.deplaceVers(nom, rdv.serviceName, dateLongue(rdv.datetime.toDate(), ctx, rdv.timezone)), {
    type: 'new_booking',
    bookingId,
  });
}

export async function notifierMembreRdvBientot(rdv: RdvMembre, minutesAvant: number, bookingId: string): Promise<void> {
  const ctx = await chargerContexteMembre(rdv.providerId, rdv.memberId);
  if (!ctx || !ctx.active('rappels')) return;
  const heure = rdv.datetime.toDate().toLocaleTimeString(ctx.intl, { hour: '2-digit', minute: '2-digit', timeZone: rdv.timezone || ctx.timeZone });
  const nom = rdv.clientInfo?.name || ctx.t.uneCliente;
  const mins = Math.round(minutesAvant);
  await envoyer(ctx, mins >= 55 ? ctx.t.rdvDansUneHeure : ctx.t.rdvDansNMinutes(mins), `${heure} — ${nom} · ${rdv.serviceName}`, {
    type: 'new_booking',
    bookingId,
  });
}

/** Résumé du matin. Rend `true` si la notification est partie (le marqueur n'est posé que dans ce cas). */
export async function notifierMembreJournee(ctx: ContexteMembre, nombre: number, premiere: string): Promise<boolean> {
  if (!ctx.active('resumeDuMatin')) return false;
  return envoyer(ctx, ctx.t.journee, nombre === 1 ? ctx.t.journeeUn(premiere) : ctx.t.journeePlusieurs(nombre, premiere), {
    type: 'provider_daily_agenda',
  });
}

export async function notifierMembreNouvelAvis(p: {
  providerId: string;
  memberId: string | null | undefined;
  note: number;
  nomCliente: string | null | undefined;
  commentaire: string | null | undefined;
  reviewId: string;
}): Promise<void> {
  const ctx = await chargerContexteMembre(p.providerId, p.memberId);
  if (!ctx || !ctx.active('avis')) return;
  await envoyer(ctx, ctx.tm.nouvelAvis, ctx.tm.avisCorps(p.nomCliente || ctx.t.uneCliente, p.note, extrait(p.commentaire)), {
    type: 'member_review',
    reviewId: p.reviewId,
  });
}
