/**
 * POST { email, memberId? } → { disponible, raison?, message? } — côté GÉRANT.
 *
 * Avant de créer un membre (ou de changer son adresse) quand l'espace membre
 * est ouvert : cette adresse deviendra son identifiant de connexion, elle ne
 * doit être ni celle d'un autre compte Opatam, ni celle d'un autre membre,
 * ni déjà invitée ailleurs. L'envoi de l'invitation refait ce contrôle.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { emailDisponiblePourMembre, MESSAGES_EMAIL_INDISPONIBLE } from '@/lib/espace-membre';
import { trouverCompteParEmail } from '@/lib/compte-par-email';

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(header.slice('Bearer '.length))).uid;
  } catch {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const memberId = typeof body?.memberId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.memberId) ? body.memberId : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ disponible: false, message: "L'adresse e-mail n'est pas valide" });
  }
  // Le salon du gérant : Provider.id === User.id.
  const r = await emailDisponiblePourMembre(getAdminFirestore(), trouverCompteParEmail, { providerId: uid, email, memberId });
  return NextResponse.json(
    r.ok ? { disponible: true } : { disponible: false, raison: r.raison, message: MESSAGES_EMAIL_INDISPONIBLE[r.raison] },
  );
}
