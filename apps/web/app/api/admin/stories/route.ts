import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET /api/admin/stories?days=30 — qui partage des stories, et lesquelles.
 *
 * Source : `storyEvents` (un doc par partage, écrit par la callable
 * recordStoryShare) — providerId, content, channel, createdAt. Agrégé ici en
 * mémoire : quelques centaines d'événements par mois, pas de quoi justifier
 * un index composite ni un cron. `days=0` = tout l'historique.
 *
 * Sert au pilotage (quel type de story marche, qui publie) et, plus tard,
 * aux récompenses / vérifications des prestataires qui publient souvent.
 */

const CONTENT_LABELS: Record<string, string> = {
  services: 'Prestations',
  availabilities: 'Disponibilités',
  review: 'Avis',
  loyalty: 'Fidélité',
  none: 'QR code',
  realisation: 'Réalisation',
  avantApres: 'Avant / après',
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const daysParam = parseInt(request.nextUrl.searchParams.get('days') || '30', 10);
  const days = Number.isFinite(daysParam) && daysParam >= 0 ? daysParam : 30;
  const db = getAdminFirestore();

  let query = db.collection('storyEvents').orderBy('createdAt', 'desc');
  if (days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.where('createdAt', '>=', since);
  }
  const snap = await query.get();

  const byContent: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  const byProvider: Record<string, { total: number; byContent: Record<string, number>; lastAt: Date | null }> = {};
  const byWeek: Record<string, number> = {};
  const recent: { providerId: string; content: string; channel: string; createdAt: string | null }[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const content = typeof d.content === 'string' ? d.content : 'none';
    const channel = typeof d.channel === 'string' ? d.channel : 'system';
    const providerId = typeof d.providerId === 'string' ? d.providerId : '';
    const at: Date | null = d.createdAt?.toDate?.() ?? null;

    byContent[content] = (byContent[content] || 0) + 1;
    byChannel[channel] = (byChannel[channel] || 0) + 1;
    if (providerId) {
      const p = (byProvider[providerId] ??= { total: 0, byContent: {}, lastAt: null });
      p.total++;
      p.byContent[content] = (p.byContent[content] || 0) + 1;
      if (at && (!p.lastAt || at > p.lastAt)) p.lastAt = at;
    }
    if (at) {
      // Semaine ISO (lundi) — clé « 2026-09-07 ».
      const monday = new Date(at);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      byWeek[key] = (byWeek[key] || 0) + 1;
    }
    if (recent.length < 30) {
      recent.push({ providerId, content, channel, createdAt: at?.toISOString() ?? null });
    }
  }

  // Noms des salons — une lecture groupée, pas une par ligne.
  const providerIds = Object.keys(byProvider);
  const names: Record<string, { businessName: string; photoURL: string | null; isPublished: boolean }> = {};
  if (providerIds.length > 0) {
    const refs = providerIds.map((id) => db.collection('providers').doc(id));
    const docs = await db.getAll(...refs);
    for (const d of docs) {
      const x = d.data();
      names[d.id] = {
        businessName: x?.businessName || 'Prestataire supprimé',
        photoURL: x?.photoURL || null,
        isPublished: x?.isPublished === true,
      };
    }
  }

  const providers = providerIds
    .map((id) => ({
      id,
      businessName: names[id]?.businessName ?? id,
      photoURL: names[id]?.photoURL ?? null,
      isPublished: names[id]?.isPublished ?? false,
      total: byProvider[id].total,
      byContent: byProvider[id].byContent,
      lastAt: byProvider[id].lastAt?.toISOString() ?? null,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    days,
    total: snap.size,
    sharers: providerIds.length,
    byContent: Object.entries(byContent)
      .map(([content, count]) => ({ content, label: CONTENT_LABELS[content] ?? content, count }))
      .sort((a, b) => b.count - a.count),
    byChannel: Object.entries(byChannel).map(([channel, count]) => ({ channel, count })),
    byWeek: Object.entries(byWeek)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    providers,
    recent: recent.map((r) => ({ ...r, businessName: names[r.providerId]?.businessName ?? r.providerId, label: CONTENT_LABELS[r.content] ?? r.content })),
    contentLabels: CONTENT_LABELS,
  });
}
