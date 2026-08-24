import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { parseDemoConfig } from '@/lib/sales-demo';

/**
 * Démos personnalisées d'un commercial.
 *
 * POST { pasted: string } — le collage brut de l'IA. Validation et
 *   normalisation côté serveur (parseDemoConfig) : le client fait la même
 *   validation pour l'UX, mais c'est ICI que la frontière se joue.
 *   → { id, url, expiresAt }
 * GET — ses démos ; manager et admin voient toute l'équipe.
 * DELETE ?id= — sa démo (manager/admin : toutes).
 *
 * Expiration 30 jours (décision produit) : vérifiée à CHAQUE rendu de la
 * page — un document expiré ne sert plus, même s'il existe encore.
 */

const DEMO_TTL_DAYS = 30;

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { pasted } = await request.json().catch(() => ({}));
  if (typeof pasted !== 'string' || !pasted.trim()) {
    return NextResponse.json({ error: 'Collez la réponse JSON de l’IA.' }, { status: 400 });
  }
  const parsed = parseDemoConfig(pasted);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'Configuration invalide', erreurs: parsed.erreurs }, { status: 400 });
  }

  const db = getAdminFirestore();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + DEMO_TTL_DAYS * 86_400_000));
  const ref = await db.collection('salesDemoLinks').add({
    config: parsed.config,
    staffUid: auth.identity.uid,
    businessName: parsed.config.businessName,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  return NextResponse.json({
    id: ref.id,
    url: `${baseUrl}/p/demo-${ref.id}`,
    expiresAt: expiresAt.toDate().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  // Cloisonnement : un commercial ne voit que SES démos.
  let query = db.collection('salesDemoLinks').orderBy('createdAt', 'desc').limit(50);
  if (auth.identity.role === 'sales') {
    query = db.collection('salesDemoLinks')
      .where('staffUid', '==', auth.identity.uid)
      .orderBy('createdAt', 'desc')
      .limit(50);
  }
  const snap = await query.get();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';

  return NextResponse.json({
    demos: snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        businessName: x.businessName,
        staffUid: x.staffUid,
        url: `${baseUrl}/p/demo-${d.id}`,
        createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
        expiresAt: x.expiresAt?.toDate?.()?.toISOString() ?? null,
        expired: (x.expiresAt?.toDate?.()?.getTime() ?? 0) < Date.now(),
      };
    }),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const db = getAdminFirestore();
  const ref = db.collection('salesDemoLinks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Démo introuvable' }, { status: 404 });
  if (auth.identity.role === 'sales' && snap.data()?.staffUid !== auth.identity.uid) {
    return NextResponse.json({ error: 'Cette démo ne vous appartient pas' }, { status: 403 });
  }
  await ref.delete();
  return NextResponse.json({ success: true });
}
