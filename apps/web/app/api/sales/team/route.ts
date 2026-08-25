import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET — l'équipe commerciale et les chiffres de chacun.
 *
 * Réservé manager/admin : un commercial ne voit pas les chiffres des autres.
 * Tout est agrégé en mémoire depuis quatre lectures plates (égalité seule,
 * aucun index composite) — les volumes du domaine commercial se comptent en
 * centaines, pas en millions.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  if (auth.identity.role === 'sales') {
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 });
  }

  const db = getAdminFirestore();
  const [staffSnap, leadsSnap, demosSnap, attributionsSnap, conversionsSnap, commissionsSnap] =
    await Promise.all([
      db.collection('staffMembers').get(),
      db.collection('salesLeads').limit(1000).get(),
      db.collection('salesDemoLinks').limit(1000).get(),
      db.collection('salesAttribution').limit(1000).get(),
      db.collection('salesConversions').limit(1000).get(),
      db.collection('salesCommissions').limit(2000).get(),
    ]);

  interface Chiffres {
    prospects: number;
    prospectsPerdus: number;
    demos: number;
    vuesDemos: number;
    comptesCrees: number;
    payants: number;
    payantsCeMois: number;
    mrrCents: number;
    commissionsVerseesCents: number;
  }
  const vide = (): Chiffres => ({
    prospects: 0,
    prospectsPerdus: 0,
    demos: 0,
    vuesDemos: 0,
    comptesCrees: 0,
    payants: 0,
    payantsCeMois: 0,
    mrrCents: 0,
    commissionsVerseesCents: 0,
  });
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);
  const parStaff = new Map<string, Chiffres>();
  const de = (uid: string) => {
    if (!parStaff.has(uid)) parStaff.set(uid, vide());
    return parStaff.get(uid)!;
  };

  leadsSnap.docs.forEach((d) => {
    const x = d.data();
    if (!x.ownerUid) return; // pool d'équipe : à personne pour l'instant
    const c = de(x.ownerUid);
    if (x.lostReason) c.prospectsPerdus += 1;
    else c.prospects += 1;
  });
  demosSnap.docs.forEach((d) => {
    const x = d.data();
    const c = de(x.staffUid);
    c.demos += 1;
    c.vuesDemos += typeof x.views === 'number' ? x.views : 0;
  });
  attributionsSnap.docs.forEach((d) => {
    de(d.data().staffUid).comptesCrees += 1;
  });
  conversionsSnap.docs.forEach((d) => {
    const x = d.data();
    const c = de(x.staffUid);
    c.payants += 1;
    c.mrrCents += typeof x.mrrCents === 'number' ? x.mrrCents : 0;
    const quand = x.firstPaidAt?.toDate?.();
    if (quand && quand >= debutMois) c.payantsCeMois += 1;
  });

  commissionsSnap.docs.forEach((d) => {
    const x = d.data();
    if (x.transferId) de(x.staffUid).commissionsVerseesCents += x.commissionCents ?? 0;
  });

  return NextResponse.json({
    team: staffSnap.docs
      .map((d) => {
        const x = d.data();
        return {
          uid: d.id,
          displayName: x.displayName ?? '—',
          email: x.email ?? '—',
          role: x.role,
          active: x.active === true,
          objectifPayantsMensuel: typeof x.objectifPayantsMensuel === 'number' ? x.objectifPayantsMensuel : null,
          tauxCommissionPct: typeof x.tauxCommissionPct === 'number' ? x.tauxCommissionPct : null,
          stripeAccountStatus: x.stripeAccountStatus ?? null,
          createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
          chiffres: parStaff.get(d.id) ?? vide(),
        };
      })
      .sort((a, b) => b.chiffres.mrrCents - a.chiffres.mrrCents),
    // Les uid qui ont des chiffres sans fiche staff (ex. comptes de test) —
    // visibles pour ne rien cacher, jamais silencieusement ignorés.
    horsEquipe: [...parStaff.keys()]
      .filter((uid) => !staffSnap.docs.some((d) => d.id === uid))
      .map((uid) => ({ uid, chiffres: parStaff.get(uid)! })),
  });
}
