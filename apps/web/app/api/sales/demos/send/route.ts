import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateSalesDemoEmail } from '@/lib/emails/salesDemo';
import { couvertureDemo } from '@/lib/sales-demo-build';

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
    coverUrl: couvertureDemo(data.config?.sector, data.photos?.cover ?? null),
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

  // Le pipeline suit tout seul : envoyer une démo à un e-mail crée le
  // prospect s'il n'existe pas, et journalise l'envoi sur sa fiche. Le
  // commercial n'a pas de double saisie à faire — c'est la condition pour
  // que le pipeline reste vrai. Best-effort : l'e-mail est parti, rien ici
  // ne doit faire échouer la réponse.
  try {
    const proprietaire = data.staffUid ?? auth.identity.uid;
    // Une démo déjà reliée à un prospect journalise sur LUI — l'upsert par
    // e-mail ne sert qu'aux démos orphelines (sinon on créerait un doublon
    // dès que l'e-mail saisi diffère de celui de la fiche).
    let dejaRelie: FirebaseFirestore.DocumentReference | null = null;
    if (typeof data.leadId === 'string' && data.leadId) {
      const l = await db.collection('salesLeads').doc(data.leadId).get();
      if (l.exists) dejaRelie = l.ref;
    }
    const existants = dejaRelie
      ? null
      : await db
          .collection('salesLeads')
          .where('ownerUid', '==', proprietaire)
          .where('email', '==', cleanEmail)
          .limit(1)
          .get();
    let leadRef;
    if (dejaRelie) {
      leadRef = dejaRelie;
      await leadRef.update({
        lastInteractionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (existants!.empty) {
      leadRef = await db.collection('salesLeads').add({
        ownerUid: proprietaire,
        stage: 'demo_realisee',
        lostReason: null,
        businessName: data.businessName ?? 'Prospect',
        contactName: null,
        email: cleanEmail,
        phone: null,
        city: data.config?.city ?? null,
        sector: 'beaute',
        isTeam: false,
        source: 'demo',
        mainPain: null,
        notes: null,
        linkedProviderId: null,
        optOut: false,
        nextActionAt: null,
        lastInteractionAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      leadRef = existants!.docs[0].ref;
      await leadRef.update({
        lastInteractionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    // L'envoi scelle la liaison si la démo était orpheline.
    if (!data.leadId) await ref.update({ leadId: leadRef.id });
    await db.collection('salesActivities').add({
      leadId: leadRef.id,
      authorUid: auth.identity.uid,
      type: 'demo',
      stage: null,
      body: `Démo « ${data.businessName ?? id} » envoyée à ${cleanEmail}`,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('[demos/send] liaison pipeline échouée:', e);
  }

  return NextResponse.json({ success: true, sentTo: cleanEmail });
}
