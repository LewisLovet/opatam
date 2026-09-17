/**
 * Écran du salon — lecture serveur (Admin SDK) de tout ce que l'écran
 * affiche : les membres du lieu, leurs horaires du jour, les rendez-vous
 * et les indisponibilités, dans le fuseau du prestataire.
 *
 * Deux garde-fous de confidentialité, appliqués ICI et nulle part ailleurs :
 *  - le client n'est désigné que par son prénom et l'initiale de son nom ;
 *  - ni e-mail, ni téléphone, ni prix ne quittent le serveur.
 *
 * Le jeton de l'écran (`salonScreens/{id}` + secret) ne donne accès qu'à
 * cette projection. Aucune écriture, aucune règle Firestore côté client.
 */

import { randomBytes } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import type { SalonScreen } from '@booking-app/shared';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const COLLECTION_ECRANS = 'salonScreens';
export const UPCOMING_MIN = 4;
export const UPCOMING_MAX = 10;
const FUSEAU_DEFAUT = 'Europe/Paris';

export interface EcranMembre {
  id: string;
  name: string;
  color: string | null;
  photoURL: string | null;
  /** Plages ouvertes aujourd'hui, en « HH:mm » local. Vide = fermé. */
  horaires: { start: string; end: string }[];
}

export interface EcranRendezVous {
  id: string;
  memberId: string | null;
  /** ISO 8601, instant réel — pour trier et comparer à « maintenant ». */
  debut: string;
  fin: string;
  /** « HH:mm » dans le fuseau du lieu — pour afficher sans se tromper. */
  debutLocal: string;
  finLocal: string;
  service: string;
  /** Plusieurs prestations : « Coupe + Brushing ». */
  services: string[];
  color: string | null;
  /** « Sarah M. » — jamais plus. */
  client: string;
  statut: 'confirmed' | 'pending';
}

export interface EcranIndispo {
  id: string;
  memberId: string;
  debutLocal: string;
  finLocal: string;
  titre: string;
}

export interface EcranPayload {
  ecran: { id: string; label: string; upcomingCount: number; showCounters: boolean; theme: 'dark' | 'light' };
  provider: { businessName: string; photoURL: string | null; themeId: string | null };
  lieu: { id: string; name: string };
  fuseau: string;
  /** « YYYY-MM-DD » du jour affiché, dans le fuseau. */
  jour: string;
  membres: EcranMembre[];
  rendezVous: EcranRendezVous[];
  indispos: EcranIndispo[];
  /** Instant du calcul, ISO. */
  genereLe: string;
}

export function genererSecretEcran(): string {
  return randomBytes(24).toString('hex');
}

/** « Sarah Martin » → « Sarah M. » ; « Sarah » → « Sarah » ; vide → « Client ». */
export function libelleClient(nom: string | null | undefined): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return 'Client';
  if (mots.length === 1) return mots[0];
  return `${mots[0]} ${mots[mots.length - 1][0].toUpperCase()}.`;
}

/** Décalage (ms) entre le fuseau demandé et UTC à un instant donné. */
function decalage(instant: Date, fuseau: string): number {
  const enFuseau = new Date(instant.toLocaleString('en-US', { timeZone: fuseau }));
  const enUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  return enFuseau.getTime() - enUtc.getTime();
}

/** « YYYY-MM-DD » d'un instant dans le fuseau. */
export function jourLocal(instant: Date, fuseau: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** « HH:mm » d'un instant dans le fuseau. */
export function heureLocale(instant: Date, fuseau: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
}

/** Jour de la semaine (0 = dimanche) d'un instant dans le fuseau. */
function jourSemaineLocal(instant: Date, fuseau: string): number {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: fuseau, weekday: 'short' }).format(instant);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(nom);
}

/**
 * Bornes réelles (UTC) de la journée locale contenant `maintenant`.
 * Indépendant du fuseau de la machine (Vercel tourne en UTC).
 */
export function bornesDuJour(maintenant: Date, fuseau: string): { debut: Date; fin: Date; jour: string; dow: number } {
  const jour = jourLocal(maintenant, fuseau);
  const minuitNaif = new Date(`${jour}T00:00:00Z`);
  const debut = new Date(minuitNaif.getTime() - decalage(minuitNaif, fuseau));
  const fin = new Date(debut.getTime() + 24 * 3600 * 1000 - 1);
  return { debut, fin, jour, dow: jourSemaineLocal(maintenant, fuseau) };
}

type Doc = FirebaseFirestore.DocumentSnapshot;
const versDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : null);

export async function lireEcran(id: string, secret: string): Promise<(SalonScreen & { id: string }) | null> {
  if (!id || !secret || secret.length < 24) return null;
  const doc = await getAdminFirestore().collection(COLLECTION_ECRANS).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() as Record<string, unknown>;
  if (data.secret !== secret) return null;
  return {
    id: doc.id,
    providerId: String(data.providerId),
    label: String(data.label ?? ''),
    locationId: String(data.locationId),
    memberIds: Array.isArray(data.memberIds) ? (data.memberIds as string[]) : null,
    upcomingCount: Number(data.upcomingCount ?? 6),
    showCounters: data.showCounters !== false,
    theme: data.theme === 'light' ? 'light' : 'dark',
    secret: String(data.secret),
    createdAt: versDate(data.createdAt) ?? new Date(0),
    lastAccessAt: versDate(data.lastAccessAt),
  };
}

/**
 * Tout ce que l'écran affiche pour la journée en cours. `null` si le lien
 * est inconnu ou révoqué (la page répond 404, sans distinguer les deux).
 */
export async function chargerEcran(id: string, secret: string, maintenant = new Date()): Promise<EcranPayload | null> {
  const ecran = await lireEcran(id, secret);
  if (!ecran) return null;
  const db = getAdminFirestore();
  const refProvider = db.collection('providers').doc(ecran.providerId);
  const providerDoc = await refProvider.get();
  if (!providerDoc.exists) return null;
  const provider = providerDoc.data() as Record<string, unknown>;
  const settings = (provider.settings ?? {}) as { timezone?: string };
  const fuseau = settings.timezone || FUSEAU_DEFAUT;
  const { debut, fin, jour, dow } = bornesDuJour(maintenant, fuseau);

  const [lieuDoc, membresSnap, dispoSnap, resaSnap, indispoSnap] = await Promise.all([
    refProvider.collection('locations').doc(ecran.locationId).get(),
    refProvider.collection('members').where('isActive', '==', true).get(),
    refProvider.collection('availability').where('dayOfWeek', '==', dow).get(),
    db.collection('bookings')
      .where('providerId', '==', ecran.providerId)
      .where('status', 'in', ['confirmed', 'pending'])
      .where('datetime', '>=', Timestamp.fromDate(debut))
      .where('datetime', '<=', Timestamp.fromDate(fin))
      .orderBy('datetime', 'asc')
      .get(),
    refProvider.collection('blockedSlots')
      .where('startDate', '<=', Timestamp.fromDate(fin))
      .where('endDate', '>=', Timestamp.fromDate(debut))
      .get(),
  ]);

  const lieu = lieuDoc.data() as Record<string, unknown> | undefined;
  const filtreMembres = ecran.memberIds ? new Set(ecran.memberIds) : null;
  const membresDocs = membresSnap.docs
    .filter((d: Doc) => (d.data() as Record<string, unknown>).locationId === ecran.locationId)
    .filter((d: Doc) => !filtreMembres || filtreMembres.has(d.id))
    .sort((a: Doc, b: Doc) => Number((a.data() as Record<string, unknown>).sortOrder ?? 0) - Number((b.data() as Record<string, unknown>).sortOrder ?? 0));
  const idsMembres = new Set(membresDocs.map((d: Doc) => d.id));

  const horairesParMembre = new Map<string, { start: string; end: string }[]>();
  for (const d of dispoSnap.docs) {
    const a = d.data() as { memberId?: string; isOpen?: boolean; slots?: { start: string; end: string }[] };
    if (!a.memberId || !idsMembres.has(a.memberId) || !a.isOpen) continue;
    horairesParMembre.set(a.memberId, (a.slots ?? []).filter((s) => s.start && s.end));
  }

  const membres: EcranMembre[] = membresDocs.map((d: Doc) => {
    const m = d.data() as { name?: string; color?: string | null; photoURL?: string | null };
    return { id: d.id, name: m.name ?? '', color: m.color ?? null, photoURL: m.photoURL ?? null, horaires: horairesParMembre.get(d.id) ?? [] };
  });

  const rendezVous: EcranRendezVous[] = [];
  for (const d of resaSnap.docs) {
    const b = d.data() as Record<string, unknown>;
    if (b.locationId !== ecran.locationId) continue;
    const memberId = typeof b.memberId === 'string' ? b.memberId : null;
    if (memberId && !idsMembres.has(memberId)) continue;
    const start = versDate(b.datetime);
    if (!start) continue;
    const finBrute = versDate(b.endDatetime);
    const end = finBrute && finBrute > start ? finBrute : new Date(start.getTime() + Number(b.duration ?? 60) * 60_000);
    const items = Array.isArray(b.items) ? (b.items as { serviceName?: string }[]) : [];
    const services = items.length ? items.map((i) => i.serviceName ?? '').filter(Boolean) : [String(b.serviceName ?? '')];
    const client = (b.clientInfo as { name?: string } | undefined)?.name;
    rendezVous.push({
      id: d.id,
      memberId,
      debut: start.toISOString(),
      fin: end.toISOString(),
      debutLocal: heureLocale(start, fuseau),
      finLocal: heureLocale(end, fuseau),
      service: services.join(' + '),
      services,
      color: (typeof b.serviceColor === 'string' && b.serviceColor) || (typeof b.memberColor === 'string' && b.memberColor) || null,
      client: libelleClient(client),
      statut: b.status === 'pending' ? 'pending' : 'confirmed',
    });
  }

  const indispos: EcranIndispo[] = [];
  for (const d of indispoSnap.docs) {
    const s = d.data() as Record<string, unknown>;
    const memberId = typeof s.memberId === 'string' ? s.memberId : '';
    if (!idsMembres.has(memberId)) continue;
    const startDate = versDate(s.startDate);
    const endDate = versDate(s.endDate);
    if (!startDate || !endDate) continue;
    // Journée entière, ou période continue qui couvre le jour : tout le jour.
    let debutLocal = '00:00';
    let finLocal = '24:00';
    const memeJour = jourLocal(startDate, fuseau) === jour;
    const memeJourFin = jourLocal(endDate, fuseau) === jour;
    if (!s.allDay && typeof s.startTime === 'string' && typeof s.endTime === 'string') {
      if (s.spanMode === 'daily' || (memeJour && memeJourFin)) { debutLocal = s.startTime; finLocal = s.endTime; }
      else if (memeJour) { debutLocal = s.startTime; }
      else if (memeJourFin) { finLocal = s.endTime; }
    }
    indispos.push({ id: d.id, memberId, debutLocal, finLocal, titre: String(s.title || s.reason || 'Indisponible') });
  }

  // Trace de la dernière consultation, au plus une fois par minute — pour
  // que le pro voie dans ses paramètres si l'écran est bien branché.
  const dernier = ecran.lastAccessAt?.getTime() ?? 0;
  if (maintenant.getTime() - dernier > 60_000) {
    void db.collection(COLLECTION_ECRANS).doc(ecran.id).update({ lastAccessAt: Timestamp.fromDate(maintenant) }).catch(() => undefined);
  }

  return {
    ecran: { id: ecran.id, label: ecran.label, upcomingCount: ecran.upcomingCount, showCounters: ecran.showCounters, theme: ecran.theme },
    provider: { businessName: String(provider.businessName ?? ''), photoURL: typeof provider.photoURL === 'string' ? provider.photoURL : null, themeId: typeof provider.themeId === 'string' ? provider.themeId : null },
    lieu: { id: ecran.locationId, name: String(lieu?.name ?? '') },
    fuseau,
    jour,
    membres,
    rendezVous,
    indispos,
    genereLe: maintenant.toISOString(),
  };
}
