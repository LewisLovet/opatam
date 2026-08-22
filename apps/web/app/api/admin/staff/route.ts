import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Gestion de l'équipe commerciale — réservée aux administrateurs.
 *
 * GET  → liste des commerciaux (actifs et désactivés).
 * POST → { email, role: 'sales'|'sales_manager', displayName? } crée ou met à
 *        jour le rôle d'un compte EXISTANT. Le commercial s'inscrit d'abord
 *        comme n'importe quel utilisateur ; l'admin le promeut ensuite par
 *        son adresse e-mail — le rôle est rattaché à l'uid Firebase, jamais
 *        déclaré par le client.
 * PATCH → { uid, active } active/désactive sans perdre l'historique.
 *
 * `staffMembers/{uid}` est inscriptible UNIQUEMENT ici (Admin SDK) : les
 * règles Firestore refusent toute écriture client, et la lecture est limitée
 * à sa propre fiche.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const snap = await getAdminFirestore()
    .collection('staffMembers')
    .orderBy('createdAt', 'desc')
    .get();

  return NextResponse.json({
    staff: snap.docs.map((d) => ({
      uid: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { email, role, displayName } = await request.json();
  if (!email || (role !== 'sales' && role !== 'sales_manager')) {
    return NextResponse.json(
      { error: "email + role ('sales' | 'sales_manager') requis" },
      { status: 400 },
    );
  }

  // Le compte doit exister : on rattache un rôle à une identité vérifiable,
  // on ne crée pas de comptes fantômes.
  let uid: string;
  let userDisplayName: string | null = null;
  try {
    const user = await getAdminAuth().getUserByEmail(String(email).trim().toLowerCase());
    uid = user.uid;
    userDisplayName = user.displayName ?? null;
  } catch {
    return NextResponse.json(
      { error: "Aucun compte avec cette adresse. Le commercial doit d'abord créer son compte Opatam." },
      { status: 404 },
    );
  }

  await getAdminFirestore().collection('staffMembers').doc(uid).set(
    {
      role,
      active: true,
      email: String(email).trim().toLowerCase(),
      displayName: displayName || userDisplayName || '',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: auth.identity.uid,
    },
    { merge: true },
  );

  return NextResponse.json({ success: true, uid, role });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { uid, active } = await request.json();
  if (!uid || typeof active !== 'boolean') {
    return NextResponse.json({ error: 'uid + active requis' }, { status: 400 });
  }

  const ref = getAdminFirestore().collection('staffMembers').doc(uid);
  if (!(await ref.get()).exists) {
    return NextResponse.json({ error: 'Commercial introuvable' }, { status: 404 });
  }
  await ref.update({ active });
  return NextResponse.json({ success: true, uid, active });
}
