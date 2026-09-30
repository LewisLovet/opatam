/**
 * Accès d'un membre à l'app — côté GÉRANT.
 *
 *   POST   { memberId } → invite (ou réinvite) : e-mail avec un lien signé
 *                         valable 7 jours ; l'invitation précédente cesse
 *                         de valoir.
 *   DELETE { memberId } → retire l'accès : compte détaché, invitations en
 *                         attente retirées. Le membre reste dans l'équipe.
 *
 * Auth : Bearer Firebase. L'uid vérifié EST le providerId (Provider.id ===
 * User.id) : un gérant n'agit que sur les membres de son salon.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { getResend, emailConfig, appConfig } from '@/lib/resend';
import { MESSAGES_EMAIL_INDISPONIBLE, preparerInvitation, retirerAcces, type RefusInvitation } from '@/lib/espace-membre';
import { trouverCompteParEmail } from '@/lib/compte-par-email';
import { signMemberInvite } from '@/lib/member-invite';
import { generateMemberInvitationEmail } from '@/lib/emails/memberInvitation';

async function gerant(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return (await getAdminAuth().verifyIdToken(header.slice('Bearer '.length))).uid;
  } catch {
    return null;
  }
}

async function memberIdDe(req: NextRequest): Promise<string | null> {
  const body = await req.json().catch(() => null);
  const memberId = body?.memberId;
  // Devient un chemin de document : jamais de « / ».
  return typeof memberId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(memberId) ? memberId : null;
}

const REFUS: Record<RefusInvitation, { status: number; message: string }> = {
  'pas-ouvert': { status: 403, message: "L'espace membre n'est pas encore ouvert à votre salon" },
  'salon-introuvable': { status: 404, message: 'Salon introuvable' },
  plan: { status: 403, message: "L'accès des membres à l'app fait partie du plan Studio" },
  'membre-introuvable': { status: 404, message: 'Membre introuvable' },
  'membre-principal': { status: 400, message: 'Vous êtes le membre principal : vous avez déjà votre accès' },
  'membre-inactif': { status: 400, message: "Réactivez d'abord ce membre pour l'inviter" },
  'sans-email': { status: 400, message: "Ajoutez une adresse e-mail à ce membre pour l'inviter" },
  'compte-existant': { status: 409, message: MESSAGES_EMAIL_INDISPONIBLE['compte-existant'] },
  'autre-membre': { status: 409, message: MESSAGES_EMAIL_INDISPONIBLE['autre-membre'] },
  'invite-ailleurs': { status: 409, message: MESSAGES_EMAIL_INDISPONIBLE['invite-ailleurs'] },
};

export async function POST(req: NextRequest) {
  const uid = await gerant(req);
  if (!uid) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const memberId = await memberIdDe(req);
  if (!memberId) return NextResponse.json({ error: 'Membre manquant' }, { status: 400 });

  const r = await preparerInvitation(getAdminFirestore(), uid, memberId, new Date(), trouverCompteParEmail);
  if (!r.ok) return NextResponse.json({ error: REFUS[r.raison].message, raison: r.raison }, { status: REFUS[r.raison].status });

  const { invitation } = r;
  const url = `${appConfig.url}/rejoindre?t=${encodeURIComponent(signMemberInvite(invitation.invitationId))}`;
  const email = generateMemberInvitationEmail({
    url,
    memberName: invitation.memberName,
    businessName: invitation.businessName,
    expiresAt: invitation.expiresAt,
  });
  const { error } = await getResend().emails.send({
    from: emailConfig.from,
    to: invitation.email,
    replyTo: emailConfig.replyTo,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) {
    console.error('[membres/acces] envoi de l’invitation', error);
    return NextResponse.json({ error: "L'invitation est prête mais l'e-mail n'est pas parti. Réessayez." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email: invitation.email, expiresAt: invitation.expiresAt.toISOString() });
}

export async function DELETE(req: NextRequest) {
  const uid = await gerant(req);
  if (!uid) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
  const memberId = await memberIdDe(req);
  if (!memberId) return NextResponse.json({ error: 'Membre manquant' }, { status: 400 });
  const r = await retirerAcces(getAdminFirestore(), uid, memberId);
  return NextResponse.json({ ok: true, ...r });
}
