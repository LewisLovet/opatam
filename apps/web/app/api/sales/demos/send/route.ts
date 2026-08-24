import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateSalesDemoEmail } from '@/lib/emails/salesDemo';

/**
 * POST { id, email } — envoie la démo au prospect, e-mail préfait.
 *
 * Même cloisonnement que le reste de /api/sales/demos : un commercial
 * n'envoie que SES démos. L'envoi est tracé sur le document (sentTo,
 * sentAt) — c'est le début d'un historique d'activité par démo.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { id, email, message } = await request.json().catch(() => ({}));
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const messagePerso = typeof message === 'string' ? message.slice(0, 600) : null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection('salesDemoLinks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Démo introuvable' }, { status: 404 });
  const data = snap.data()!;
  if (auth.identity.role === 'sales' && data.staffUid !== auth.identity.uid) {
    return NextResponse.json({ error: 'Cette démo ne vous appartient pas' }, { status: 403 });
  }
  const expiresAt: Date | null = data.expiresAt?.toDate?.() ?? null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'Cette démo est expirée — modifiez-la pour la réactiver avant de l’envoyer.' },
      { status: 400 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json({ error: 'Envoi d’e-mails non configuré (RESEND_API_KEY)' }, { status: 500 });
  }

  // Le prénom du commercial signe l'e-mail — il vit sur staffMembers, pas
  // dans le jeton.
  const staffSnap = await db.collection('staffMembers').doc(auth.identity.uid).get();
  const fromName: string | null = staffSnap.data()?.displayName ?? null;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  const { subject, html } = generateSalesDemoEmail({
    businessName: data.businessName ?? 'Votre établissement',
    demoUrl: `${baseUrl}/p/demo-${id}`,
    expiresLe: expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    fromName,
    message: messagePerso,
  });

  const { Resend } = await import('resend');
  await new Resend(resendApiKey).emails.send({
    from: 'Opatam <noreply@kamerleontech.com>',
    to: cleanEmail,
    subject,
    html,
  });

  await ref.update({
    sentTo: FieldValue.arrayUnion(cleanEmail),
    sentAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, sentTo: cleanEmail });
}
