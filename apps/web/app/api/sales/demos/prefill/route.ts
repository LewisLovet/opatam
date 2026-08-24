import { NextRequest, NextResponse } from 'next/server';
import { loadDemo } from '@/lib/sales-demo-load';
import { prixEffectif } from '@/lib/sales-demo';

/**
 * GET ?id=<demoId> — la démo au format du tunnel d'inscription.
 *
 * PUBLIC, comme la page de démo elle-même : le prospect qui clique « Valider
 * cette page » arrive sur /register avec ses prestations déjà remplies — il
 * relit, ajuste, et son compte se crée avec sa carte en place. C'est la
 * validation par l'humain qui rend l'import sûr : rien n'est écrit en base
 * avant qu'il ait déroulé le tunnel.
 *
 * Unités : le tunnel attend le prix de BASE en euros et les prix des
 * variations/options en CENTIMES (c'est sa convention interne, voir
 * RegisterPage). Les « sur devis » (sans prix exploitable) sont écartées,
 * comme sur la page de démo.
 */

/** Secteur de démo → catégorie d'activité du compte. */
const SECTEUR_VERS_CATEGORIE: Record<string, string> = {
  coiffure: 'beauty',
  barbier: 'beauty',
  ongles: 'beauty',
  esthetique: 'beauty',
  maquillage: 'beauty',
  cils: 'beauty',
  tatouage: 'beauty',
  massage: 'wellness',
  spa: 'wellness',
};

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const demo = await loadDemo(id);
  if (!demo) return NextResponse.json({ error: 'Démo introuvable ou expirée' }, { status: 404 });
  const c = demo.config;

  const cle = (c.sector ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const category =
    Object.entries(SECTEUR_VERS_CATEGORIE).find(([k]) => cle.includes(k))?.[1] ?? 'beauty';

  const services = c.categories.flatMap((cat, ci) =>
    cat.services
      .filter((s) => prixEffectif(s) !== null)
      .map((s, si) => ({
        name: s.name,
        duration: s.duration ?? 60,
        price: (prixEffectif(s) as number) / 100, // base en euros
        priceMax: null,
        description: s.description ?? '',
        category: cat.name,
        variations:
          s.variations?.map((v, vi) => ({
            id: `demo-${ci}-${si}-var-${vi}`,
            name: v.name,
            options: v.options.map((o, oi) => ({
              id: `demo-${ci}-${si}-var-${vi}-opt-${oi}`,
              name: o.name,
              price: o.price, // centimes
              duration: o.duration ?? s.duration ?? 60,
            })),
          })) ?? [],
        options:
          s.options?.map((o, oi) => ({
            id: `demo-${ci}-${si}-sup-${oi}`,
            name: o.name,
            description: null,
            price: o.price, // centimes, ajoutés
            duration: o.duration ?? 0,
            nestedVariations: [],
            nestedInfoFields: [],
          })) ?? [],
        infoFields: [],
      })),
  );

  return NextResponse.json({
    businessName: c.businessName,
    category,
    description: c.description ?? '',
    city: c.city ?? '',
    services,
  });
}
