import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST { id } — prendre en charge un prospect du POOL d'équipe.
 *
 * Premier arrivé, premier servi, et une seule fois : la transaction refuse
 * si un autre commercial l'a pris entre-temps — deux commerciaux qui
 * appellent le même prospect, c'est la crédibilité de l'équipe qui saute.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { id } = await request.json().catch(() => ({}));
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const db = getAdminFirestore();
  const ref = db.collection('salesLeads').doc(id);

  const resultat = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { status: 404 as const, error: 'Prospect introuvable' };
    const x = snap.data()!;
    if (x.ownerUid !== null) {
      return { status: 409 as const, error: 'Ce prospect a déjà été pris en charge par un autre commercial' };
    }
    tx.update(ref, {
      ownerUid: auth.identity.uid,
      lastInteractionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { status: 200 as const };
  });

  if (resultat.status !== 200) {
    return NextResponse.json({ error: resultat.error }, { status: resultat.status });
  }
  await db.collection('salesActivities').add({
    leadId: id,
    authorUid: auth.identity.uid,
    type: 'note',
    stage: null,
    body: 'Prospect pris en charge depuis le pool d’équipe',
    createdAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ success: true });
}
