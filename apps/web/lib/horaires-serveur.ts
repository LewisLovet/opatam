/**
 * Horaires d'une équipe, jour par jour, lus par le SDK ADMIN — pour les
 * surfaces calculées sur le serveur (écran du salon, widget d'occupation).
 *
 * Même règle que le moteur de créneaux (`horairesDuJour`) : semaine type
 * avec ses changements programmés, horaires datés, option « horaires
 * variables ». Sans elle, l'écran du salon affichait la semaine type un
 * jour fermé par un réglage daté, et le widget ne voyait pas un samedi
 * ouvert exceptionnellement.
 */
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { lecteurHorairesEquipe, type HoraireDateLu, type HoraireSemaineLu, type HorairesDuJour } from '@booking-app/shared';

const versDate = (v: unknown): Date | null => (v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : null);

export async function lireHorairesEquipe(p: {
  refProvider: DocumentReference;
  /** Dates du lieu (« YYYY-MM-DD »), bornes incluses. */
  du: string;
  au: string;
  /** Les membres concernés, avec leur option « horaires variables ». */
  membres: readonly { id: string; variableHours?: unknown }[];
  /** Date d'effet d'un changement programmé → date calendaire du lieu. */
  jourDEffet: (d: Date) => string;
  /** Un seul jour de la semaine suffit (écran du salon) : lecture réduite. */
  jourSemaine?: number;
}): Promise<(memberId: string, jour: string) => HorairesDuJour> {
  const requeteSemaine =
    p.jourSemaine === undefined
      ? p.refProvider.collection('availability')
      : p.refProvider.collection('availability').where('dayOfWeek', '==', p.jourSemaine);
  const [semaineSnap, datesDocs] = await Promise.all([
    requeteSemaine.get(),
    // Jamais bloquant : illisibles, on garde la semaine type.
    p.refProvider
      .collection('datedAvailability')
      .where('to', '>=', p.du)
      .get()
      .then((s) => s.docs)
      .catch((err) => {
        console.warn('[horaires] horaires datés illisibles, semaine type appliquée', err);
        return [];
      }),
  ]);

  const semaine: (HoraireSemaineLu & { memberId: string })[] = [];
  for (const d of semaineSnap.docs) {
    const a = d.data() as Record<string, unknown>;
    if (typeof a.memberId !== 'string' || typeof a.dayOfWeek !== 'number') continue;
    semaine.push({
      memberId: a.memberId,
      dayOfWeek: a.dayOfWeek,
      isOpen: a.isOpen === true,
      slots: Array.isArray(a.slots) ? (a.slots as { start: string; end: string }[]).filter((s) => s?.start && s?.end) : [],
      effectiveFrom: versDate(a.effectiveFrom),
    });
  }

  const dates: (HoraireDateLu & { memberId: string })[] = [];
  for (const d of datesDocs) {
    const r = d.data() as Record<string, unknown>;
    if (typeof r.memberId !== 'string' || typeof r.from !== 'string' || typeof r.to !== 'string') continue;
    if (r.from > p.au) continue;
    if (r.mode !== 'slots' && r.mode !== 'closed' && r.mode !== 'usual') continue;
    dates.push({
      memberId: r.memberId,
      from: r.from,
      to: r.to,
      weekdays: Array.isArray(r.weekdays) ? (r.weekdays as number[]) : [],
      mode: r.mode,
      slots: Array.isArray(r.slots) ? (r.slots as { start: string; end: string }[]) : [],
      createdAt: versDate(r.createdAt),
    });
  }

  return lecteurHorairesEquipe({
    semaine,
    dates,
    membresVariables: p.membres.filter((m) => m.variableHours === true).map((m) => m.id),
    jourDEffet: p.jourDEffet,
  });
}
