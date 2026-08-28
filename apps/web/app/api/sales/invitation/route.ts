import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { signSalesLink } from '@/lib/sales-attribution';
import { generateSalesInvitationEmail } from '@/lib/emails/salesInvitation';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Invitation SANS offre — un simple e-mail qui incite à prendre l'abonnement
 * (essai gratuit en tête), avec le lien d'attribution signé du commercial.
 * Le pendant de /api/sales/offres quand une remise n'est pas justifiée :
 * proposer une offre ne doit jamais être obligatoire.
 *
 * Même garde que les offres : fiche commerciale ACTIVE requise (l'attribution
 * doit avoir un responsable). Tracé dans salesInvitations.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { email, message, leadId } = await request.json().catch(() => ({}));
  const cleanEmail =
    typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
      ? email.trim().toLowerCase()
      : null;
  if (!cleanEmail) {
    return NextResponse.json({ error: 'E-mail du prospect requis' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const fiche = await db.collection('staffMembers').doc(auth.identity.uid).get();
  if (!fiche.exists || fiche.data()?.active !== true) {
    return NextResponse.json(
      { error: 'Réservé aux fiches commerciales actives — votre compte n’en a pas.' },
      { status: 403 },
    );
  }

  // Cloisonnement (même règle que les offres) : on n'envoie pas d'invitation
  // journalisée sur le prospect d'un AUTRE commercial.
  const leadIdPropre = typeof leadId === 'string' && leadId ? leadId : null;
  if (leadIdPropre) {
    const leadSnap = await db.collection('salesLeads').doc(leadIdPropre).get();
    if (!leadSnap.exists) {
      return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
    }
    if (auth.identity.role === 'sales' && leadSnap.data()?.ownerUid !== auth.identity.uid) {
      return NextResponse.json({ error: 'Ce prospect ne vous appartient pas' }, { status: 403 });
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const token = signSalesLink({
    staffUid: auth.identity.uid,
    campaign: 'invitation',
    sector: null,
  });
  const url = `${baseUrl}/register?s=${encodeURIComponent(token)}`;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Envoi d’e-mails non configuré' }, { status: 500 });
  }
  const { subject, html } = generateSalesInvitationEmail({
    url,
    fromName: fiche.data()?.displayName ?? null,
    message: typeof message === 'string' ? message.slice(0, 1200) : null,
  });
  try {
    const { Resend } = await import('resend');
    const { error } = await new Resend(resendApiKey).emails.send({
      from: 'Opatam <noreply@kamerleontech.com>',
      to: cleanEmail,
      subject,
      html,
    });
    if (error) throw new Error(String(error));
  } catch (e) {
    console.error('[sales/invitation] envoi échoué:', e);
    return NextResponse.json({ error: 'Envoi de l’e-mail impossible — réessayez' }, { status: 502 });
  }

  // Traçabilité (même philosophie que les codes générés) + journal du lead.
  await db.collection('salesInvitations').add({
    staffUid: auth.identity.uid,
    email: cleanEmail,
    leadId: leadIdPropre,
    sentAt: FieldValue.serverTimestamp(),
  });
  if (leadIdPropre) {
    // Journal du lead — collection racine, même forme que /leads/activities.
    await db
      .collection('salesActivities')
      .add({
        leadId: leadIdPropre,
        authorUid: auth.identity.uid,
        type: 'email',
        stage: null,
        body: `Invitation sans offre envoyée à ${cleanEmail}`,
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true, url });
}
