/**
 * POST { email } → { enAttente: boolean }
 *
 * Avant de créer un compte PROFESSIONNEL, l'inscription demande si cette
 * adresse a une invitation de membre en attente. Un membre qui se trompe de
 * bouton (« Créer un compte » au lieu du lien reçu) ferait de son adresse
 * celle d'un salon — et ne pourrait plus rejoindre son équipe.
 *
 * Ne répond QUE oui/non : ni le salon, ni le membre. Accepter reste
 * réservé au lien reçu par e-mail, qui seul prouve que l'adresse est à lui.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { invitationEnAttentePour } from '@/lib/espace-membre';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ enAttente: false });
  }
  try {
    return NextResponse.json({ enAttente: await invitationEnAttentePour(getAdminFirestore(), email) });
  } catch (err) {
    console.error('[invitation-en-attente]', err);
    // Jamais bloquant pour une inscription.
    return NextResponse.json({ enAttente: false });
  }
}
