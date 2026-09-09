import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { verifyStaffInvite } from '@/lib/staff-invite';

/**
 * Atterrissage du lien d'invitation d'un commercial (valable 7 jours).
 *
 * PUBLIC (le commercial n'a pas encore de mot de passe) mais inexploitable
 * sans jeton signé valide. Au clic : jeton vérifié → fiche commerciale
 * active → lien Firebase de définition du mot de passe fabriqué MAINTENANT
 * (sa courte validité court à partir d'ici) → redirection vers ce lien, qui
 * atterrit sur /sales une fois le mot de passe posé.
 *
 * Jeton expiré ou invalide → page « Mot de passe oublié » avec un mot
 * d'explication : la voie de secours reste toujours ouverte.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  const secours = (raison: string) =>
    NextResponse.redirect(`${baseUrl}/forgot-password?invitation=${raison}`, 302);

  const token = request.nextUrl.searchParams.get('t') ?? '';
  const verif = token ? verifyStaffInvite(token) : ({ ok: false, reason: 'malformed' } as const);
  if (!verif.ok) return secours(verif.reason === 'expired' ? 'expiree' : 'invalide');

  const fiche = await getAdminFirestore().collection('staffMembers').doc(verif.uid).get();
  if (!fiche.exists || fiche.data()?.active !== true) return secours('invalide');

  try {
    const user = await getAdminAuth().getUser(verif.uid);
    if (!user.email || user.disabled) return secours('invalide');
    const lienFirebase = await getAdminAuth().generatePasswordResetLink(user.email, {
      url: `${baseUrl}/sales`,
    });
    return NextResponse.redirect(lienFirebase, 302);
  } catch (e) {
    console.error('[admin/staff/invite] lien Firebase impossible:', e);
    return secours('invalide');
  }
}
