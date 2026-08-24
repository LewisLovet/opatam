import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { leadCreateSchema, leadUpdateSchema } from '@/lib/sales-leads';

/**
 * Prospects du pipeline commercial.
 *
 * POST — créer un prospect (ownerUid = l'appelant).
 * GET — ses prospects ; manager/admin voient tout. Jusqu'à 300, triés par
 *   dernière mise à jour. Le filtrage fin (étape, recherche) est client :
 *   un pipeline de commercial tient en mémoire, et le Kanban a besoin de
 *   toutes les colonnes de toute façon.
 * PATCH { id, ...champs } — mise à jour ; un changement d'étape est
 *   journalisé dans salesActivities (l'historique des passages est la
 *   matière du tunnel, il ne doit jamais se perdre).
 * DELETE ?id= — suppression (RGPD : un prospect peut exiger l'effacement) ;
 *   ses activités partent avec lui.
 */

function serialise(id: string, x: FirebaseFirestore.DocumentData) {
  return {
    id,
    ownerUid: x.ownerUid,
    stage: x.stage,
    lostReason: x.lostReason ?? null,
    businessName: x.businessName,
    contactName: x.contactName ?? null,
    email: x.email ?? null,
    phone: x.phone ?? null,
    city: x.city ?? null,
    sector: x.sector ?? 'beaute',
    isTeam: !!x.isTeam,
    source: x.source ?? null,
    mainPain: x.mainPain ?? null,
    notes: x.notes ?? null,
    linkedProviderId: x.linkedProviderId ?? null,
    optOut: !!x.optOut,
    nextActionAt: x.nextActionAt?.toDate?.()?.toISOString() ?? null,
    lastInteractionAt: x.lastInteractionAt?.toDate?.()?.toISOString() ?? null,
    createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: x.updatedAt?.toDate?.()?.toISOString() ?? null,
  };
}

async function leadAccessible(id: string, identity: { uid: string; role: string }) {
  const ref = getAdminFirestore().collection('salesLeads').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, status: 404, error: 'Prospect introuvable' };
  if (identity.role === 'sales' && snap.data()?.ownerUid !== identity.uid) {
    return { ok: false as const, status: 403, error: 'Ce prospect ne vous appartient pas' };
  }
  return { ok: true as const, ref, snap };
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const parsed = leadCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const db = getAdminFirestore();
  const ref = await db.collection('salesLeads').add({
    ownerUid: auth.identity.uid,
    stage: d.stage,
    lostReason: null,
    businessName: d.businessName,
    contactName: d.contactName ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    city: d.city ?? null,
    sector: d.sector,
    isTeam: d.isTeam,
    source: d.source ?? null,
    mainPain: d.mainPain ?? null,
    notes: d.notes ?? null,
    linkedProviderId: null,
    optOut: false,
    nextActionAt: d.nextActionAt ? new Date(d.nextActionAt) : null,
    lastInteractionAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const snap = await ref.get();
  return NextResponse.json({ lead: serialise(ref.id, snap.data()!) });
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  let query = db.collection('salesLeads').orderBy('updatedAt', 'desc').limit(300);
  if (auth.identity.role === 'sales') {
    query = db
      .collection('salesLeads')
      .where('ownerUid', '==', auth.identity.uid)
      .orderBy('updatedAt', 'desc')
      .limit(300);
  }
  const snap = await query.get();
  return NextResponse.json({ leads: snap.docs.map((d) => serialise(d.id, d.data())) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const parsed = leadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    );
  }

  const acces = await leadAccessible(id, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  const avant = acces.snap.data()!;
  const d = parsed.data;
  const maj: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const champ of [
    'businessName',
    'contactName',
    'email',
    'phone',
    'city',
    'sector',
    'isTeam',
    'source',
    'mainPain',
    'notes',
    'stage',
    'lostReason',
    'optOut',
  ] as const) {
    if (champ in body && d[champ] !== undefined) maj[champ] = d[champ];
  }
  if ('nextActionAt' in body) {
    maj.nextActionAt = d.nextActionAt ? new Date(d.nextActionAt) : null;
  }

  const db = getAdminFirestore();
  await acces.ref.update(maj);

  // Le passage d'étape se journalise — c'est la matière première du tunnel.
  if (typeof maj.stage === 'string' && maj.stage !== avant.stage) {
    await db.collection('salesActivities').add({
      leadId: id,
      authorUid: auth.identity.uid,
      type: 'changement_etape',
      stage: maj.stage,
      body: `${avant.stage} → ${maj.stage}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const apres = await acces.ref.get();
  return NextResponse.json({ lead: serialise(id, apres.data()!) });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const acces = await leadAccessible(id, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  const db = getAdminFirestore();
  // RGPD : l'effacement emporte le journal.
  const activites = await db.collection('salesActivities').where('leadId', '==', id).get();
  const batch = db.batch();
  activites.docs.forEach((a) => batch.delete(a.ref));
  batch.delete(acces.ref);
  await batch.commit();
  return NextResponse.json({ success: true });
}

