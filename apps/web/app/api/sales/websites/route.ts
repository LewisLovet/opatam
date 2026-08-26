import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { SALES_SECTORS } from '@booking-app/shared';

/**
 * Portfolio des sites web vendus/réalisés — la vitrine de l'offre « site
 * web + Opatam intégré » (400–800 €, commission 50 %).
 *
 * GET    — tout le staff : la liste des réalisations à montrer au prospect.
 * POST   — manager/admin : ajoute une réalisation (lien + contexte).
 * DELETE — manager/admin : retire une réalisation (?id=).
 *
 * Collection `salesWebsites`, accédée uniquement par ces routes (Admin SDK,
 * deny-by-default côté règles — aucune modification de rules nécessaire).
 */

const ajoutSchema = z.object({
  name: z.string().min(2).max(80),
  url: z
    .string()
    .url({ message: 'URL invalide (https://…)' })
    .max(300)
    .refine((u) => u.startsWith('https://') || u.startsWith('http://'), 'URL invalide'),
  // Référentiel Opatam — pas de champ libre (cohérence avec les prospects).
  sector: z.enum(SALES_SECTORS).or(z.literal('')).optional().default(''),
  description: z.string().max(300).optional().default(''),
  priceEuros: z.number().int().min(0).max(5000).nullable().optional(),
});

function estManager(role: string | undefined): boolean {
  return role === 'sales_manager' || role === 'admin';
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const snap = await getAdminFirestore()
    .collection('salesWebsites')
    .limit(100)
    .get();
  return NextResponse.json({
    sites: snap.docs
      .map((d) => {
        const x = d.data();
        return {
          id: d.id,
          name: x.name ?? '',
          url: x.url ?? '',
          sector: x.sector ?? '',
          description: x.description ?? '',
          priceEuros: typeof x.priceEuros === 'number' ? x.priceEuros : null,
          createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
        };
      })
      // Tri en mémoire (pas d'index) — les plus récents d'abord.
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  if (!estManager(auth.identity.role)) {
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 });
  }

  const parsed = ajoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide' },
      { status: 400 },
    );
  }

  const ref = await getAdminFirestore().collection('salesWebsites').add({
    ...parsed.data,
    priceEuros: parsed.data.priceEuros ?? null,
    addedBy: auth.identity.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true, id: ref.id });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  if (!estManager(auth.identity.role)) {
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  await getAdminFirestore().collection('salesWebsites').doc(id).delete();
  return NextResponse.json({ ok: true });
}
