import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET — l'identité commerciale de l'appelant : rôle effectif (la « vue
 * commerciale » l'abaisse), objectif mensuel et taux de commission.
 * Un admin sans fiche staffMembers a un objectif nul — rien n'est promis.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const staffSnap = await getAdminFirestore()
    .collection('staffMembers')
    .doc(auth.identity.uid)
    .get();
  const x = staffSnap.data();
  return NextResponse.json({
    uid: auth.identity.uid,
    role: auth.identity.role,
    displayName: x?.displayName ?? null,
    objectifPayantsMensuel: typeof x?.objectifPayantsMensuel === 'number' ? x.objectifPayantsMensuel : null,
    tauxCommissionPct: typeof x?.tauxCommissionPct === 'number' ? x.tauxCommissionPct : null,
  });
}
