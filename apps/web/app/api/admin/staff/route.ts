import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateStaffWelcomeEmail } from '@/lib/emails/staffWelcome';

/**
 * Gestion de l'équipe commerciale — réservée aux administrateurs.
 *
 * GET  → liste des commerciaux (actifs et désactivés).
 * POST → { email, role: 'sales'|'sales_manager', displayName? } INVITE un
 *        commercial : crée le compte s'il n'existe pas (rôle 'staff', hors
 *        stats clients), pose le rôle, et envoie le lien de définition du
 *        mot de passe avec atterrissage /sales. Jamais d'inscription
 *        publique pour l'équipe.
 * PATCH → { uid, active } active/désactive sans perdre l'historique.
 *
 * `staffMembers/{uid}` est inscriptible UNIQUEMENT ici (Admin SDK) : les
 * règles Firestore refusent toute écriture client, et la lecture est limitée
 * à sa propre fiche.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const snap = await getAdminFirestore()
    .collection('staffMembers')
    .orderBy('createdAt', 'desc')
    .get();

  return NextResponse.json({
    staff: snap.docs.map((d) => ({
      uid: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { email, role, displayName } = await request.json();
  if (!email || (role !== 'sales' && role !== 'sales_manager')) {
    return NextResponse.json(
      { error: "email + role ('sales' | 'sales_manager') requis" },
      { status: 400 },
    );
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const db = getAdminFirestore();
  const adminAuth = getAdminAuth();

  // INVITATION, pas inscription : si aucun compte n'existe, il est créé ICI,
  // par l'Admin SDK, avec le rôle 'staff' — le commercial ne passe jamais
  // par le signup public, qui mène à l'expérience client. S'il avait déjà un
  // compte Opatam, on le promeut sans toucher à son rôle applicatif.
  let uid: string;
  let mode: 'new' | 'existing';
  let name = displayName || '';
  try {
    const existing = await adminAuth.getUserByEmail(cleanEmail);
    uid = existing.uid;
    mode = 'existing';
    name = name || existing.displayName || cleanEmail.split('@')[0];
  } catch {
    mode = 'new';
    name = name || cleanEmail.split('@')[0];
    const created = await adminAuth.createUser({ email: cleanEmail, displayName: name });
    uid = created.uid;
    await db.collection('users').doc(uid).set({
      email: cleanEmail,
      displayName: name,
      phone: null,
      photoURL: null,
      role: 'staff', // hors des statistiques clients/prestataires
      providerId: null,
      affiliateId: null,
      city: null,
      birthYear: null,
      gender: null,
      cancellationCount: 0,
      pushTokens: [],
      isDisabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await db.collection('staffMembers').doc(uid).set(
    {
      role,
      active: true,
      email: cleanEmail,
      displayName: name,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: auth.identity.uid,
    },
    { merge: true },
  );

  // Lien de définition du mot de passe (nouveaux comptes), atterrissage /sales.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  let inviteLink: string | null = null;
  if (mode === 'new') {
    inviteLink = await adminAuth.generatePasswordResetLink(cleanEmail, {
      url: `${baseUrl}/sales`,
    });
  }

  // E-mail de bienvenue — best-effort : le lien est AUSSI retourné à l'admin,
  // qui peut le transmettre lui-même si l'e-mail n'arrive pas.
  let emailSent = false;
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const { Resend } = await import('resend');
      const { subject, html } = generateStaffWelcomeEmail({
        name,
        role,
        mode,
        resetLink: inviteLink ?? undefined,
      });
      await new Resend(resendApiKey).emails.send({
        from: 'Opatam <noreply@kamerleontech.com>',
        to: cleanEmail,
        subject,
        html,
      });
      emailSent = true;
    }
  } catch (e) {
    console.error('[admin/staff] invitation email failed (non-blocking):', e);
  }

  return NextResponse.json({ success: true, uid, role, mode, emailSent, inviteLink });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { uid, active, objectifPayantsMensuel, tauxCommissionPct } = await request.json();
  if (!uid) return NextResponse.json({ error: 'uid requis' }, { status: 400 });

  const maj: Record<string, unknown> = {};
  if (typeof active === 'boolean') maj.active = active;
  // Objectif et commission — réglés par l'ADMIN uniquement (c'est de la
  // rémunération) ; null efface, rien n'est promis tant que c'est vide.
  if (objectifPayantsMensuel === null || typeof objectifPayantsMensuel === 'number') {
    maj.objectifPayantsMensuel =
      typeof objectifPayantsMensuel === 'number'
        ? Math.max(0, Math.min(1000, Math.round(objectifPayantsMensuel)))
        : null;
  }
  if (tauxCommissionPct === null || typeof tauxCommissionPct === 'number') {
    maj.tauxCommissionPct =
      typeof tauxCommissionPct === 'number'
        ? Math.max(0, Math.min(100, Math.round(tauxCommissionPct * 100) / 100))
        : null;
  }
  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  const ref = getAdminFirestore().collection('staffMembers').doc(uid);
  if (!(await ref.get()).exists) {
    return NextResponse.json({ error: 'Commercial introuvable' }, { status: 404 });
  }
  await ref.update(maj);
  return NextResponse.json({ success: true, uid, ...maj });
}
