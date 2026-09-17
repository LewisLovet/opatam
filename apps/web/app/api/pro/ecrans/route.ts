/**
 * Écrans du salon d'un prestataire — création, liste, révocation.
 *
 *   GET    /api/pro/ecrans           → la liste, avec l'URL de chacun
 *   POST   /api/pro/ecrans           → crée un écran { label, locationId, memberIds, upcomingCount, showCounters, theme }
 *   DELETE /api/pro/ecrans?id=…      → révoque (le lien meurt aussitôt)
 *
 * Auth : Bearer Firebase, l'uid vérifié EST le providerId. Même contrat
 * que /api/pro/calendar-feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { COLLECTION_ECRANS, UPCOMING_MAX, UPCOMING_MIN, genererSecretEcran, lireAffichageClient } from '@/lib/ecran';

const MAX_ECRANS = 10;

async function requireProvider(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return (await getAdminAuth().verifyIdToken(header.slice('Bearer '.length))).uid;
  } catch {
    return null;
  }
}

function baseUrl(req: NextRequest): string {
  if (process.env.NODE_ENV === 'production') return 'https://opatam.com';
  return `${req.nextUrl.protocol}//${req.headers.get('host') ?? 'localhost:3000'}`;
}

function urlEcran(req: NextRequest, id: string, secret: string): string {
  return `${baseUrl(req)}/ecran/${id}?k=${secret}`;
}

export interface EcranResume {
  id: string;
  label: string;
  locationId: string;
  memberIds: string[] | null;
  upcomingCount: number;
  showCounters: boolean;
  clientDisplay: 'name' | 'service' | 'both';
  theme: 'dark' | 'light';
  url: string;
  createdAt: string;
  lastAccessAt: string | null;
}

function resumer(req: NextRequest, doc: FirebaseFirestore.QueryDocumentSnapshot): EcranResume {
  const d = doc.data();
  const versIso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null);
  return {
    id: doc.id,
    label: String(d.label ?? ''),
    locationId: String(d.locationId),
    memberIds: Array.isArray(d.memberIds) ? d.memberIds : null,
    upcomingCount: Number(d.upcomingCount ?? 6),
    showCounters: d.showCounters !== false,
    clientDisplay: lireAffichageClient(d.clientDisplay),
    theme: d.theme === 'light' ? 'light' : 'dark',
    url: urlEcran(req, doc.id, String(d.secret)),
    createdAt: versIso(d.createdAt) ?? new Date(0).toISOString(),
    lastAccessAt: versIso(d.lastAccessAt),
  };
}

export async function GET(req: NextRequest) {
  const providerId = await requireProvider(req);
  if (!providerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const snap = await getAdminFirestore().collection(COLLECTION_ECRANS).where('providerId', '==', providerId).get();
  const ecrans = snap.docs.map((d) => resumer(req, d)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return NextResponse.json({ ecrans }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const providerId = await requireProvider(req);
  if (!providerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const corps = (await req.json().catch(() => null)) as Partial<{
    label: string; locationId: string; memberIds: string[] | null; upcomingCount: number; showCounters: boolean; clientDisplay: string; theme: string;
  }> | null;
  const label = (corps?.label ?? '').trim().slice(0, 60);
  const locationId = (corps?.locationId ?? '').trim();
  if (!label || !locationId) return NextResponse.json({ error: 'Libellé et lieu requis' }, { status: 400 });

  const db = getAdminFirestore();
  const refProvider = db.collection('providers').doc(providerId);
  const [lieu, existants] = await Promise.all([
    refProvider.collection('locations').doc(locationId).get(),
    db.collection(COLLECTION_ECRANS).where('providerId', '==', providerId).get(),
  ]);
  if (!lieu.exists) return NextResponse.json({ error: 'Lieu inconnu' }, { status: 400 });
  if (existants.size >= MAX_ECRANS) return NextResponse.json({ error: `${MAX_ECRANS} écrans au maximum` }, { status: 400 });

  // Les membres demandés doivent être ceux du lieu ; une liste vide vaut « tous ».
  let memberIds: string[] | null = null;
  if (Array.isArray(corps?.memberIds) && corps.memberIds.length) {
    const membres = await refProvider.collection('members').where('locationId', '==', locationId).get();
    const valides = new Set(membres.docs.map((d) => d.id));
    memberIds = corps.memberIds.filter((id): id is string => typeof id === 'string' && valides.has(id));
    if (!memberIds.length) memberIds = null;
  }
  const upcomingCount = Math.min(UPCOMING_MAX, Math.max(UPCOMING_MIN, Math.round(Number(corps?.upcomingCount ?? 6)) || 6));

  const ref = db.collection(COLLECTION_ECRANS).doc();
  const secret = genererSecretEcran();
  const maintenant = Timestamp.now();
  await ref.set({
    providerId, label, locationId, memberIds, upcomingCount,
    showCounters: corps?.showCounters !== false,
    clientDisplay: lireAffichageClient(corps?.clientDisplay),
    theme: corps?.theme === 'light' ? 'light' : 'dark',
    secret, createdAt: maintenant, lastAccessAt: null,
  });
  const cree = await ref.get();
  return NextResponse.json({ ecran: resumer(req, cree as FirebaseFirestore.QueryDocumentSnapshot) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const providerId = await requireProvider(req);
  if (!providerId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'Identifiant requis' }, { status: 400 });
  const ref = getAdminFirestore().collection(COLLECTION_ECRANS).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.providerId !== providerId) return NextResponse.json({ error: 'Écran introuvable' }, { status: 404 });
  await ref.delete();
  return NextResponse.json({ ok: true });
}
