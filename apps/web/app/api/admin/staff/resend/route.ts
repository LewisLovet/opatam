import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateStaffWelcomeEmail } from '@/lib/emails/staffWelcome';
import { buildStaffInviteUrl } from '@/lib/staff-invite';

/**
 * Renvoyer l'invitation d'un commercial — { uid }.
 *
 * Nouveau lien d'invitation (7 jours) + nouvel e-mail de bienvenue. Le lien
 * est aussi retourné à l'admin, qui peut le transmettre lui-même si l'e-mail
 * n'arrive pas. Réservé aux administrateurs, comme la création.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { uid } = await request.json().catch(() => ({}));
  if (typeof uid !== 'string' || !uid) {
    return NextResponse.json({ error: 'uid requis' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection('staffMembers').doc(uid);
  const fiche = await ref.get();
  if (!fiche.exists) {
    return NextResponse.json({ error: 'Commercial introuvable' }, { status: 404 });
  }
  if (fiche.data()?.active !== true) {
    return NextResponse.json(
      { error: 'Fiche désactivée — réactivez-la avant de renvoyer l’invitation' },
      { status: 409 },
    );
  }

  let email: string;
  try {
    const user = await getAdminAuth().getUser(uid);
    if (!user.email) throw new Error('compte sans e-mail');
    email = user.email;
  } catch {
    return NextResponse.json({ error: 'Compte Firebase introuvable' }, { status: 404 });
  }

  const role: 'sales' | 'sales_manager' =
    fiche.data()?.role === 'sales_manager' ? 'sales_manager' : 'sales';
  const name = fiche.data()?.displayName || email.split('@')[0];
  const inviteLink = buildStaffInviteUrl(uid);

  let emailSent = false;
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const { Resend } = await import('resend');
      const { subject, html } = generateStaffWelcomeEmail({
        name,
        role,
        mode: 'new',
        resetLink: inviteLink,
        renvoi: true,
      });
      const { error } = await new Resend(resendApiKey).emails.send({
        from: 'Opatam <noreply@kamerleontech.com>',
        to: email,
        subject,
        html,
      });
      if (error) throw new Error(String(error));
      emailSent = true;
    }
  } catch (e) {
    console.error('[admin/staff/resend] e-mail non parti (non bloquant):', e);
  }

  await ref.update({
    invitationResentAt: FieldValue.serverTimestamp(),
    invitationResentBy: auth.identity.uid,
  });

  return NextResponse.json({ success: true, uid, email, emailSent, inviteLink });
}
