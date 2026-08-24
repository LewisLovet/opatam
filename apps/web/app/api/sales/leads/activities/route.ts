import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { activityCreateSchema } from '@/lib/sales-leads';

/**
 * Journal d'un prospect — notes, appels, e-mails, passages d'étape.
 *
 * GET ?leadId= — le journal, du plus récent au plus ancien.
 * POST { leadId, type, body } — une entrée ; met à jour lastInteractionAt
 *   sur le prospect (c'est ce qui nourrit « dernière interaction » partout).
 */

async function leadAccessible(leadId: string, identity: { uid: string; role: string }) {
  const ref = getAdminFirestore().collection('salesLeads').doc(leadId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, status: 404, error: 'Prospect introuvable' };
  if (identity.role === 'sales' && snap.data()?.ownerUid !== identity.uid) {
    return { ok: false as const, status: 403, error: 'Ce prospect ne vous appartient pas' };
  }
  return { ok: true as const, ref };
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const leadId = request.nextUrl.searchParams.get('leadId');
  if (!leadId) return NextResponse.json({ error: 'leadId requis' }, { status: 400 });
  const acces = await leadAccessible(leadId, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  // Égalité seule + tri en mémoire — pas d'index composite à déployer.
  const snap = await getAdminFirestore()
    .collection('salesActivities')
    .where('leadId', '==', leadId)
    .limit(300)
    .get();
  const activities = snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        type: x.type,
        stage: x.stage ?? null,
        body: x.body ?? null,
        authorUid: x.authorUid,
        createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const parsed = activityCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    );
  }
  const acces = await leadAccessible(parsed.data.leadId, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  const db = getAdminFirestore();
  await db.collection('salesActivities').add({
    leadId: parsed.data.leadId,
    authorUid: auth.identity.uid,
    type: parsed.data.type,
    stage: null,
    body: parsed.data.body,
    createdAt: FieldValue.serverTimestamp(),
  });
  await acces.ref.update({
    lastInteractionAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ success: true });
}
