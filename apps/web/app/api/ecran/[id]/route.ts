/**
 * Écran du salon — la journée, pour un lien signé.
 *
 *   GET /api/ecran/{id}?k={secret}
 *
 * Appelée par la page /ecran toutes les 60 s. Pas de session, pas de
 * cookie : le couple id + secret est la seule clé. Un lien inconnu ou
 * révoqué répond 404, sans dire lequel. Jamais mis en cache : l'agenda
 * bouge dans la journée.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chargerEcran } from '@/lib/ecran';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const secret = req.nextUrl.searchParams.get('k') ?? '';
  try {
    const payload = await chargerEcran(id, secret);
    if (!payload) return NextResponse.json({ error: 'Écran introuvable' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (err) {
    console.error('[ecran] lecture impossible :', err);
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
