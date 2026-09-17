/**
 * Widget « vue semaine » — calcul serveur (Admin SDK) de l'occupation
 * publique d'un prestataire sur une semaine.
 *
 * Ce qui sort d'ici est PUBLIC et mis en cache sur le CDN : par créneau,
 * combien de membres sont libres, et rien d'autre. En vue solo ou membre
 * fixé, une case complète porte la couleur et le nom de la prestation
 * (ce que le pro affiche déjà sur sa page) — jamais qui l'a réservée.
 *
 * Lecture batchée : disponibilités, réservations et indisponibilités de la
 * semaine en une passe, jamais jour par jour.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { bornesDeJour, heureLocale, jourLocal } from '@/lib/ecran';
import type { CaseOccupation, CategorieOccupation, JourOccupation, OccupationPayload } from '@/lib/occupation-types';

const FUSEAU_DEFAUT = 'Europe/Paris';
const PAS_AUTORISES = new Set([30, 60]);
export const OCCUPATION_SEMAINES_MAX = 1;

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type Intervalle = [number, number];
const chevauche = (a: Intervalle, b: Intervalle) => a[0] < b[1] && b[0] < a[1];

/** Le lundi (YYYY-MM-DD) de la semaine contenant `jour`, dans le fuseau. */
function lundiDe(jour: string, fuseau: string, decalage: number): string {
  const { debut, dow } = bornesDeJour(jour, fuseau);
  const recul = (dow + 6) % 7;
  const lundi = new Date(debut.getTime() - recul * 86_400_000 + decalage * 7 * 86_400_000 + 12 * 3_600_000);
  return jourLocal(lundi, fuseau);
}

function jourPlus(jour: string, n: number, fuseau: string): string {
  const { debut } = bornesDeJour(jour, fuseau);
  return jourLocal(new Date(debut.getTime() + n * 86_400_000 + 12 * 3_600_000), fuseau);
}

export interface OccupationOptions {
  slug: string;
  semaine: number;
  memberId?: string | null;
  pas?: number;
}

export async function chargerOccupation(opts: OccupationOptions, maintenant = new Date()): Promise<OccupationPayload | null> {
  const db = getAdminFirestore();
  const provSnap = await db.collection('providers').where('slug', '==', opts.slug).limit(1).get();
  if (provSnap.empty) return null;
  const provDoc = provSnap.docs[0];
  const provider = provDoc.data() as Record<string, unknown>;
  if (provider.isPublished !== true) return null;
  const providerId = provDoc.id;
  const settings = (provider.settings ?? {}) as { timezone?: string; minBookingNotice?: number; maxBookingAdvance?: number };
  const fuseau = settings.timezone || FUSEAU_DEFAUT;
  const pas = PAS_AUTORISES.has(opts.pas ?? 30) ? (opts.pas ?? 30) : 30;
  const semaine = Math.min(OCCUPATION_SEMAINES_MAX, Math.max(0, Math.floor(opts.semaine || 0)));

  const aujourdhui = jourLocal(maintenant, fuseau);
  const lundi = lundiDe(aujourdhui, fuseau, semaine);
  const dates = Array.from({ length: 7 }, (_, i) => jourPlus(lundi, i, fuseau));
  const debutSemaine = bornesDeJour(dates[0], fuseau).debut;
  const finSemaine = bornesDeJour(dates[6], fuseau).fin;
  // Horizon de réservation : avant le préavis minimal, un créneau est « passé » ;
  // au-delà de l'avance maximale, il est fermé à la réservation.
  const preavisMs = Math.max(0, Number(settings.minBookingNotice ?? 2)) * 3_600_000;
  const avanceJours = Math.max(1, Number(settings.maxBookingAdvance ?? 60));
  const limiteAvance = new Date(maintenant.getTime() + avanceJours * 86_400_000);
  const limitePreavis = new Date(maintenant.getTime() + preavisMs);

  const refProvider = db.collection('providers').doc(providerId);
  const [membresSnap, dispoSnap, resaSnap, indispoSnap] = await Promise.all([
    refProvider.collection('members').where('isActive', '==', true).get(),
    refProvider.collection('availability').get(),
    db.collection('bookings')
      .where('providerId', '==', providerId)
      .where('status', 'in', ['confirmed', 'pending', 'pending_payment'])
      .where('datetime', '>=', Timestamp.fromDate(debutSemaine))
      .where('datetime', '<=', Timestamp.fromDate(finSemaine))
      .get(),
    refProvider.collection('blockedSlots')
      .where('startDate', '<=', Timestamp.fromDate(finSemaine))
      .where('endDate', '>=', Timestamp.fromDate(debutSemaine))
      .get(),
  ]);

  let membres = membresSnap.docs
    .map((d) => ({ id: d.id, name: String((d.data() as { name?: string }).name ?? ''), sortOrder: Number((d.data() as { sortOrder?: number }).sortOrder ?? 0) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (opts.memberId) membres = membres.filter((m) => m.id === opts.memberId);
  if (!membres.length) return null;
  const idsMembres = new Set(membres.map((m) => m.id));
  const vueDetaillee = membres.length === 1;

  // Horaires par membre et jour de semaine.
  const horaires = new Map<string, Intervalle[]>(); // clé `${memberId}:${dow}`
  for (const d of dispoSnap.docs) {
    const a = d.data() as { memberId?: string; dayOfWeek?: number; isOpen?: boolean; slots?: { start: string; end: string }[] };
    if (!a.memberId || !idsMembres.has(a.memberId) || !a.isOpen || typeof a.dayOfWeek !== 'number') continue;
    horaires.set(`${a.memberId}:${a.dayOfWeek}`, (a.slots ?? []).filter((s) => s.start && s.end).map((s) => [minutes(s.start), minutes(s.end)] as Intervalle));
  }

  // Réservations par membre et jour, en minutes locales.
  type Resa = { intervalle: Intervalle; serviceId: string; serviceName: string; color: string | null };
  const resas = new Map<string, Resa[]>(); // clé `${memberId}:${date}`
  const versDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : null);
  for (const d of resaSnap.docs) {
    const b = d.data() as Record<string, unknown>;
    const memberId = typeof b.memberId === 'string' ? b.memberId : null;
    if (!memberId || !idsMembres.has(memberId)) continue;
    const start = versDate(b.datetime);
    if (!start) continue;
    const finBrute = versDate(b.endDatetime);
    const end = finBrute && finBrute > start ? finBrute : new Date(start.getTime() + Number(b.duration ?? 60) * 60_000);
    const date = jourLocal(start, fuseau);
    const cle = `${memberId}:${date}`;
    const memeJour = jourLocal(end, fuseau) === date;
    resas.set(cle, [...(resas.get(cle) ?? []), {
      intervalle: [minutes(heureLocale(start, fuseau)), memeJour ? minutes(heureLocale(end, fuseau)) : 24 * 60],
      serviceId: String(b.serviceId ?? ''),
      serviceName: String(b.serviceName ?? ''),
      color: (typeof b.serviceColor === 'string' && b.serviceColor) || (typeof b.memberColor === 'string' && b.memberColor) || null,
    }]);
  }

  // Indisponibilités par membre et jour.
  const indispos = new Map<string, Intervalle[]>();
  for (const d of indispoSnap.docs) {
    const s = d.data() as Record<string, unknown>;
    const memberId = typeof s.memberId === 'string' ? s.memberId : '';
    if (!idsMembres.has(memberId)) continue;
    const startDate = versDate(s.startDate);
    const endDate = versDate(s.endDate);
    if (!startDate || !endDate) continue;
    const jourDebut = jourLocal(startDate, fuseau);
    const jourFin = jourLocal(endDate, fuseau);
    for (const date of dates) {
      if (date < jourDebut || date > jourFin) continue;
      let iv: Intervalle = [0, 24 * 60];
      if (!s.allDay && typeof s.startTime === 'string' && typeof s.endTime === 'string') {
        if (s.spanMode === 'daily' || (date === jourDebut && date === jourFin)) iv = [minutes(s.startTime), minutes(s.endTime)];
        else if (date === jourDebut) iv = [minutes(s.startTime), 24 * 60];
        else if (date === jourFin) iv = [0, minutes(s.endTime)];
      }
      const cle = `${memberId}:${date}`;
      indispos.set(cle, [...(indispos.get(cle) ?? []), iv]);
    }
  }

  // Amplitude de la grille : de la première ouverture à la dernière fermeture
  // de la semaine, à l'heure ronde ; 9 h – 19 h au minimum pour une grille stable.
  let debutGrille = 9 * 60, finGrille = 19 * 60;
  for (const ivs of horaires.values()) for (const [a, b] of ivs) { debutGrille = Math.min(debutGrille, a); finGrille = Math.max(finGrille, b); }
  debutGrille = Math.floor(debutGrille / 60) * 60;
  finGrille = Math.min(24 * 60, Math.ceil(finGrille / 60) * 60);
  const creneaux: number[] = [];
  for (let m = debutGrille; m < finGrille; m += pas) creneaux.push(m);

  const categories = new Map<string, CategorieOccupation>();
  const jours: JourOccupation[] = dates.map((date) => {
    const { debut: debutJour, dow } = bornesDeJour(date, fuseau);
    const cases: CaseOccupation[] = creneaux.map((m) => {
      const slot: Intervalle = [m, m + pas];
      const instant = new Date(debutJour.getTime() + m * 60_000);
      let total = 0, libres = 0; let cat: string | null = null;
      for (const membre of membres) {
        const ouverts = horaires.get(`${membre.id}:${dow}`) ?? [];
        const ouvert = ouverts.some(([a, b]) => slot[0] >= a && slot[1] <= b);
        if (!ouvert) continue;
        const bloque = (indispos.get(`${membre.id}:${date}`) ?? []).some((iv) => chevauche(iv, slot));
        if (bloque) continue;
        total++;
        const pris = (resas.get(`${membre.id}:${date}`) ?? []).find((r) => chevauche(r.intervalle, slot));
        if (pris) {
          if (vueDetaillee) {
            // La légende est par COULEUR : plusieurs prestations partagent
            // souvent la même teinte, une entrée par prestation la noierait.
            const couleur = (pris.color ?? '#6b7280').toLowerCase();
            cat = couleur;
            const existante = categories.get(couleur);
            if (!existante) categories.set(couleur, { id: couleur, label: pris.serviceName, color: couleur });
            else if (pris.serviceName && !existante.label.includes(pris.serviceName)) {
              const noms = existante.label.split(', ');
              existante.label = noms.length >= 2 ? `${noms.slice(0, 2).join(', ')}…` : `${existante.label}, ${pris.serviceName}`;
            }
          }
        } else {
          libres++;
        }
      }
      if (total === 0) return { etat: 'ferme', libres: 0, total: 0, cat: null };
      if (instant < limitePreavis) return { etat: 'passe', libres: 0, total, cat: null };
      if (instant > limiteAvance) return { etat: 'ferme', libres: 0, total: 0, cat: null };
      if (libres === 0) return { etat: 'complet', libres: 0, total, cat };
      return { etat: libres === total ? 'libre' : 'partiel', libres, total, cat: null };
    });
    return { date, ouvert: cases.some((c) => c.etat !== 'ferme'), cases };
  });

  return {
    slug: opts.slug,
    businessName: String(provider.businessName ?? ''),
    themeId: typeof provider.themeId === 'string' ? provider.themeId : null,
    membres: membres.map((m) => ({ id: m.id, name: m.name })),
    membreFixe: opts.memberId ?? null,
    semaine,
    lundi,
    pas,
    creneaux: creneaux.map(hhmm),
    jours,
    categories: [...categories.values()],
    genereLe: maintenant.toISOString(),
  };
}
