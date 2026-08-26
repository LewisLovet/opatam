import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Tendances de l'espace commercial — la matière première de la page
 * Performance (managers). Regroupements par MOIS calculés en mémoire :
 * requêtes plates sans index composite (règle du chantier sales).
 *
 * Les chiffres PAR COMMERCIAL viennent de /api/sales/team — cette route ne
 * fournit que ce qui manque : la dimension temporelle.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  if (auth.identity.role === 'sales') {
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 });
  }

  const db = getAdminFirestore();
  const [leadsSnap, demosSnap, conversionsSnap, commissionsSnap] = await Promise.all([
    db.collection('salesLeads').limit(2000).get(),
    db.collection('salesDemoLinks').limit(2000).get(),
    db.collection('salesConversions').limit(2000).get(),
    db.collection('salesCommissions').limit(5000).get(),
  ]);

  // 12 mois glissants, du plus ancien au plus récent.
  const mois: string[] = [];
  const maintenant = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const cleDe = (date: Date | undefined): string | null =>
    date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : null;

  const vide = () => ({ prospects: 0, demos: 0, payants: 0, mrrAjouteCents: 0, commissionsCents: 0 });
  const parMois = new Map<string, ReturnType<typeof vide>>(mois.map((m) => [m, vide()]));
  const bucket = (cle: string | null) => (cle && parMois.has(cle) ? parMois.get(cle)! : null);

  leadsSnap.docs.forEach((d) => {
    const b = bucket(cleDe(d.data().createdAt?.toDate?.()));
    if (b) b.prospects += 1;
  });
  demosSnap.docs.forEach((d) => {
    const b = bucket(cleDe(d.data().createdAt?.toDate?.()));
    if (b) b.demos += 1;
  });
  conversionsSnap.docs.forEach((d) => {
    const x = d.data();
    const b = bucket(cleDe(x.firstPaidAt?.toDate?.()));
    if (b) {
      b.payants += 1;
      b.mrrAjouteCents += typeof x.mrrCents === 'number' ? x.mrrCents : 0;
    }
  });
  commissionsSnap.docs.forEach((d) => {
    const x = d.data();
    if (!x.transferId) return;
    const b = bucket(cleDe(x.createdAt?.toDate?.()));
    if (b) b.commissionsCents += x.commissionCents ?? 0;
  });

  return NextResponse.json({
    tendance: mois.map((m) => ({ mois: m, ...parMois.get(m)! })),
  });
}
