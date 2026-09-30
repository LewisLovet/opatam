/**
 * Invitation d'un membre — côté MEMBRE (page /rejoindre).
 *
 *   GET  ?t=<jeton>  → ce que la page affiche : salon, prénom, adresse
 *                      invitée — ou pourquoi le lien ne vaut plus.
 *   POST { t }       → accepte, pour le compte connecté (Bearer Firebase).
 *                      Le compte doit porter l'adresse invitée.
 *
 * Le jeton est signé (HMAC) et ne désigne qu'un document d'invitation ;
 * c'est ce document qui dit si le lien vaut encore.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { accepterInvitation, lireInvitation, type RefusAcceptation } from '@/lib/espace-membre';
import { verifyMemberInvite } from '@/lib/member-invite';

const MESSAGES: Record<RefusAcceptation | 'lien-invalide', string> = {
  'lien-invalide': "Ce lien d'invitation n'est pas valide.",
  introuvable: "Cette invitation n'existe plus.",
  expiree: 'Ce lien a expiré : demandez à votre salon de vous renvoyer une invitation.',
  acceptee: 'Cette invitation a déjà été utilisée.',
  remplacee: 'Une invitation plus récente vous a été envoyée : utilisez le dernier e-mail reçu.',
  retiree: "Cette invitation a été retirée par le salon.",
  plan: "Votre salon n'a plus accès à l'espace membre pour le moment.",
  'membre-inactif': 'Votre fiche membre est désactivée : rapprochez-vous de votre salon.',
  'autre-email': "Vous êtes connecté avec une autre adresse que celle invitée.",
  'compte-pro': 'Cette adresse est celle d’un compte professionnel : elle ne peut pas rejoindre un autre salon.',
  'deja-membre': 'Ce compte est déjà relié à un autre salon ou à un autre membre.',
};

function invitationDuJeton(t: unknown): string | null {
  const v = verifyMemberInvite(t);
  return v.ok ? v.invitationId : null;
}

export async function GET(req: NextRequest) {
  const invitationId = invitationDuJeton(req.nextUrl.searchParams.get('t'));
  if (!invitationId) return NextResponse.json({ error: MESSAGES['lien-invalide'], raison: 'lien-invalide' }, { status: 400 });
  const r = await lireInvitation(getAdminFirestore(), invitationId);
  if (!r.ok) return NextResponse.json({ error: MESSAGES[r.raison], raison: r.raison }, { status: 410 });
  const { businessName, memberName, email } = r.invitation;
  return NextResponse.json({ businessName, memberName, email });
}

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Connectez-vous pour accepter' }, { status: 401 });
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(header.slice('Bearer '.length))).uid;
  } catch {
    return NextResponse.json({ error: 'Session expirée, reconnectez-vous' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const invitationId = invitationDuJeton(body?.t);
  if (!invitationId) return NextResponse.json({ error: MESSAGES['lien-invalide'], raison: 'lien-invalide' }, { status: 400 });

  // L'adresse du COMPTE, lue côté serveur — jamais celle que déclarerait le navigateur.
  const compte = await getAdminAuth().getUser(uid);
  const r = await accepterInvitation(getAdminFirestore(), { invitationId, uid, emailDuCompte: compte.email });
  if (!r.ok) return NextResponse.json({ error: MESSAGES[r.raison], raison: r.raison }, { status: 409 });
  return NextResponse.json({ ok: true });
}
