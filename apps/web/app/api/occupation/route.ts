/**
 * Widget « vue semaine » — occupation publique d'un prestataire.
 *
 *   GET /api/occupation?slug=…&semaine=0|1[&member=…][&pas=30|60]
 *
 * Réponse mise en cache sur le CDN quelques minutes : elle ne contient
 * aucune donnée personnelle, et le tunnel de réservation garde le dernier
 * mot sur la disponibilité réelle d'un créneau. Un prestataire inconnu ou
 * non publié répond 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chargerOccupation } from '@/lib/occupation';

export const dynamic = 'force-dynamic';

const CACHE = 'public, s-maxage=180, stale-while-revalidate=600';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = (sp.get('slug') ?? '').trim();
  if (!slug || !/^[a-z0-9-]{1,80}$/i.test(slug)) return NextResponse.json({ error: 'slug requis' }, { status: 400 });
  const semaine = Number(sp.get('semaine') ?? 0);
  const member = (sp.get('member') ?? '').trim() || null;
  const pas = Number(sp.get('pas') ?? 30);
  try {
    const payload = await chargerOccupation({ slug, semaine: Number.isFinite(semaine) ? semaine : 0, memberId: member, pas: Number.isFinite(pas) ? pas : 30 });
    if (!payload) return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=60' } });
    return NextResponse.json(payload, { headers: { 'Cache-Control': CACHE } });
  } catch (err) {
    console.error('[occupation] calcul impossible :', err);
    return NextResponse.json({ error: 'Calcul impossible' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
