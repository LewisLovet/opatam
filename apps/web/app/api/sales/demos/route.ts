import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { parseDemoConfig, configEnEuros, demoConfigStoredSchema } from '@/lib/sales-demo';
import { PROVIDER_THEMES, SALES_STAGES } from '@booking-app/shared';
import { couvertureDemo } from '@/lib/sales-demo-build';

/**
 * Démos personnalisées d'un commercial.
 *
 * POST { pasted: string } — le collage brut de l'IA. Validation et
 *   normalisation côté serveur (parseDemoConfig) : le client fait la même
 *   validation pour l'UX, mais c'est ICI que la frontière se joue.
 *   → { id, url, expiresAt }
 * GET — ses démos ; manager et admin voient toute l'équipe.
 *   ?id=<demoId> — le détail d'UNE démo, config reconvertie en euros, pour
 *   l'éditer dans /sales/demo puis la recoller (PATCH).
 * PATCH { id, pasted } — remplace la configuration d'une démo existante,
 *   même lien, et repousse l'expiration de 30 jours (une démo qu'on
 *   retravaille est un prospect vivant).
 * DELETE ?id= — sa démo (manager/admin : toutes).
 *
 * Expiration 30 jours (décision produit) : vérifiée à CHAQUE rendu de la
 * page — un document expiré ne sert plus, même s'il existe encore.
 */

const DEMO_TTL_DAYS = 30;

/** Thème choisi à la main par le commercial — écrit dans la config, où il
 *  prime sur la couleur relevée par l'IA. Une valeur inconnue est ignorée. */
function appliquerTheme(config: { themeId?: string }, themeId: unknown): void {
  // null = retour à l'automatique (couleur du document) — efface un choix
  // manuel resté dans le JSON rechargé par « Modifier ».
  if (themeId === null) {
    delete config.themeId;
    return;
  }
  if (typeof themeId === 'string' && PROVIDER_THEMES.some((t) => t.id === themeId)) {
    config.themeId = themeId;
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { pasted, themeId, leadId } = await request.json().catch(() => ({}));
  if (typeof pasted !== 'string' || !pasted.trim()) {
    return NextResponse.json({ error: 'Collez la réponse JSON de l’IA.' }, { status: 400 });
  }
  const parsed = parseDemoConfig(pasted);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Configuration invalide', erreurs: parsed.erreurs }, { status: 400 });
  }
  appliquerTheme(parsed.config, themeId);

  const db = getAdminFirestore();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + DEMO_TTL_DAYS * 86_400_000));
  const ref = await db.collection('salesDemoLinks').add({
    config: parsed.config,
    staffUid: auth.identity.uid,
    businessName: parsed.config.businessName,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  // Démo créée DEPUIS une fiche prospect : la liaison se fait à la naissance.
  if (typeof leadId === 'string' && leadId) {
    const snapCree = await ref.get();
    await relierProspect(db, ref, snapCree.data()!, leadId, auth.identity);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  return NextResponse.json({
    id: ref.id,
    url: `${baseUrl}/p/demo-${ref.id}`,
    expiresAt: expiresAt.toDate().toISOString(),
  });
}

/**
 * Relie une démo à un prospect : vérifie que le prospect appartient au même
 * commercial, écrit leadId sur la démo, avance l'étape du prospect jusqu'à
 * « Démo faite » si elle est en amont, et journalise. `leadId: null` délie.
 */
async function relierProspect(
  db: FirebaseFirestore.Firestore,
  demoRef: FirebaseFirestore.DocumentReference,
  demoData: FirebaseFirestore.DocumentData,
  leadId: string | null,
  identity: { uid: string; role: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (leadId === null) {
    await demoRef.update({ leadId: FieldValue.delete() });
    return { ok: true };
  }
  const leadSnap = await db.collection('salesLeads').doc(leadId).get();
  if (!leadSnap.exists) return { ok: false, error: 'Prospect introuvable', status: 404 };
  const lead = leadSnap.data()!;
  // Le prospect doit appartenir au propriétaire de la démo — un manager qui
  // relie le fait AU NOM du commercial, pas au sien.
  if (lead.ownerUid !== (demoData.staffUid ?? identity.uid)) {
    return { ok: false, error: 'Ce prospect n’appartient pas au commercial de la démo', status: 403 };
  }
  await demoRef.update({ leadId });
  const idxActuel = SALES_STAGES.indexOf(lead.stage);
  const idxDemo = SALES_STAGES.indexOf('demo_realisee');
  const maj: Record<string, unknown> = {
    lastInteractionAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (idxActuel >= 0 && idxActuel < idxDemo) maj.stage = 'demo_realisee';
  await leadSnap.ref.update(maj);
  await db.collection('salesActivities').add({
    leadId,
    authorUid: identity.uid,
    type: 'demo',
    stage: null,
    body: `Démo reliée : « ${demoData.businessName ?? demoRef.id} »`,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

/** Charge une démo en vérifiant qu'elle appartient à l'appelant (sauf manager/admin). */
async function demoAccessible(id: string, identity: { uid: string; role: string }) {
  const ref = getAdminFirestore().collection('salesDemoLinks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false as const, status: 404, error: 'Démo introuvable' };
  if (identity.role === 'sales' && snap.data()?.staffUid !== identity.uid) {
    return { ok: false as const, status: 403, error: 'Cette démo ne vous appartient pas' };
  }
  return { ok: true as const, ref, snap };
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  const baseUrlDetail = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';

  // Détail d'une démo, config en euros — la forme éditable.
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const acces = await demoAccessible(id, auth.identity);
    if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });
    const stored = demoConfigStoredSchema.safeParse(acces.snap.data()?.config);
    if (!stored.success) {
      return NextResponse.json({ error: 'Configuration illisible' }, { status: 500 });
    }
    const x = acces.snap.data()!;
    const staffSnap = await db.collection('staffMembers').doc(x.staffUid ?? '-').get();
    return NextResponse.json({
      id,
      url: `${baseUrlDetail}/p/demo-${id}`,
      businessName: x.businessName ?? stored.data.businessName,
      staffUid: x.staffUid ?? null,
      // Ce que l'e-mail d'envoi utilisera — pour un aperçu fidèle côté client.
      coverUrl: couvertureDemo(stored.data.sector, x.photos?.cover ?? null),
      fromName: staffSnap.data()?.displayName ?? null,
      configEuros: configEnEuros(stored.data as never),
      photos: { logo: x.photos?.logo ?? null, cover: x.photos?.cover ?? null },
      views: typeof x.views === 'number' ? x.views : 0,
      lastViewedAt: x.lastViewedAt?.toDate?.()?.toISOString() ?? null,
      sentTo: Array.isArray(x.sentTo) ? x.sentTo : [],
      claimedProviderName: x.claimedProviderName ?? null,
      leadId: x.leadId ?? null,
      expiresAt: x.expiresAt?.toDate?.()?.toISOString() ?? null,
      expired: (x.expiresAt?.toDate?.()?.getTime() ?? 0) < Date.now(),
    });
  }
  // Cloisonnement : un commercial ne voit que SES démos. Égalité seule +
  // tri en mémoire — pas d'index composite à déployer.
  const query =
    auth.identity.role === 'sales'
      ? db.collection('salesDemoLinks').where('staffUid', '==', auth.identity.uid).limit(300)
      : db.collection('salesDemoLinks').limit(300);
  const snap = await query.get();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';

  return NextResponse.json({
    demos: snap.docs.sort((a, b) => {
      const ta = a.data().createdAt?.toDate?.()?.getTime() ?? 0;
      const tb = b.data().createdAt?.toDate?.()?.getTime() ?? 0;
      return tb - ta;
    }).map((d) => {
      const x = d.data();
      return {
        id: d.id,
        businessName: x.businessName,
        staffUid: x.staffUid,
        url: `${baseUrl}/p/demo-${d.id}`,
        createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
        expiresAt: x.expiresAt?.toDate?.()?.toISOString() ?? null,
        expired: (x.expiresAt?.toDate?.()?.getTime() ?? 0) < Date.now(),
        // Signaux commerciaux — le cœur de la relance.
        views: typeof x.views === 'number' ? x.views : 0,
        lastViewedAt: x.lastViewedAt?.toDate?.()?.toISOString() ?? null,
        sentTo: Array.isArray(x.sentTo) ? x.sentTo : [],
        claimedProviderName: x.claimedProviderName ?? null,
        photos: { logo: x.photos?.logo ?? null, cover: x.photos?.cover ?? null },
        coverUrl: couvertureDemo(x.config?.sector, x.photos?.cover ?? null),
        leadId: x.leadId ?? null,
      };
    }),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { id, pasted, themeId, leadId } = body;
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  // Liaison (ou déliaison) SEULE : pas de pasted → on ne touche pas à la
  // configuration, on relie la démo à un prospect.
  if ((typeof pasted !== 'string' || !pasted.trim()) && 'leadId' in body) {
    const accesLien = await demoAccessible(id, auth.identity);
    if (!accesLien.ok) return NextResponse.json({ error: accesLien.error }, { status: accesLien.status });
    const res = await relierProspect(
      getAdminFirestore(),
      accesLien.ref,
      accesLien.snap.data()!,
      typeof leadId === 'string' ? leadId : null,
      auth.identity,
    );
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json({ success: true, leadId: typeof leadId === 'string' ? leadId : null });
  }

  if (typeof pasted !== 'string' || !pasted.trim()) {
    return NextResponse.json({ error: 'Collez la réponse JSON de l’IA.' }, { status: 400 });
  }
  const parsed = parseDemoConfig(pasted);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Configuration invalide', erreurs: parsed.erreurs }, { status: 400 });
  }
  appliquerTheme(parsed.config, themeId);

  const acces = await demoAccessible(id, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });

  const expiresAt = Timestamp.fromDate(new Date(Date.now() + DEMO_TTL_DAYS * 86_400_000));
  await acces.ref.update({
    config: parsed.config,
    businessName: parsed.config.businessName,
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt, // retravaillée = prospect vivant : 30 jours repartent
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  return NextResponse.json({
    id,
    url: `${baseUrl}/p/demo-${id}`,
    expiresAt: expiresAt.toDate().toISOString(),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const acces = await demoAccessible(id, auth.identity);
  if (!acces.ok) return NextResponse.json({ error: acces.error }, { status: acces.status });
  await acces.ref.delete();
  return NextResponse.json({ success: true });
}
