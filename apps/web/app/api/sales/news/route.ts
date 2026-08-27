import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Dernières nouvelles de l'équipe — le fil d'émulation du tableau de bord
 * (système incitatif 2026-08) : voir les autres avancer donne envie
 * d'avancer. Visible par TOUT le staff.
 *
 * Rien de nouveau n'est écrit : le fil est reconstruit depuis les
 * collections existantes (prospects, démos, conversions, prises en charge,
 * réattributions). Regroupement en mémoire, requêtes plates — la règle du
 * chantier (pas d'index composite).
 */

interface Nouvelle {
  type: 'prospect' | 'demo' | 'payant' | 'prise' | 'etape';
  texte: string;
  auteurNom: string;
  auteurInitiales: string;
  date: string; // ISO
}

function initialesDe(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return mots.length === 0 ? '?' : mots.slice(0, 2).map((m) => m[0]!.toUpperCase()).join('');
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  const [staffSnap, leadsSnap, demosSnap, conversionsSnap, activitesSnap] = await Promise.all([
    db.collection('staffMembers').get(),
    db.collection('salesLeads').limit(500).get(),
    db.collection('salesDemoLinks').limit(500).get(),
    db.collection('salesConversions').limit(500).get(),
    db.collection('salesActivities').limit(1000).get(),
  ]);

  const noms = new Map<string, string>();
  staffSnap.docs.forEach((d) => noms.set(d.id, d.data().displayName ?? '—'));
  const nomDe = (uid: string | null | undefined) => (uid ? (noms.get(uid) ?? 'Un membre') : "L'équipe");
  const leadNom = new Map<string, string>();
  leadsSnap.docs.forEach((d) => leadNom.set(d.id, d.data().businessName ?? 'un prospect'));

  const nouvelles: Nouvelle[] = [];
  const pousser = (type: Nouvelle['type'], uid: string | null | undefined, texte: string, date?: Date) => {
    if (!date) return;
    const nom = nomDe(uid);
    nouvelles.push({ type, texte, auteurNom: nom, auteurInitiales: initialesDe(nom), date: date.toISOString() });
  };

  leadsSnap.docs.forEach((d) => {
    const x = d.data();
    const auteur = x.ownerUid ?? x.pushedBy;
    const ville = x.city ? ` (${x.city})` : '';
    pousser(
      'prospect',
      auteur,
      x.ownerUid
        ? `a ajouté le prospect « ${x.businessName} »${ville}`
        : `a proposé « ${x.businessName} »${ville} à l'équipe`,
      x.createdAt?.toDate?.(),
    );
  });
  demosSnap.docs.forEach((d) => {
    const x = d.data();
    pousser('demo', x.staffUid, `a créé la démo « ${x.businessName ?? 'sans nom'} »`, x.createdAt?.toDate?.());
  });
  conversionsSnap.docs.forEach((d) => {
    const x = d.data();
    const mrr = typeof x.mrrCents === 'number' ? ` — +${Math.round(x.mrrCents / 100)} € de MRR` : '';
    pousser('payant', x.staffUid, `a converti un abonné payant${mrr} 🎉`, x.firstPaidAt?.toDate?.());
  });
  activitesSnap.docs.forEach((d) => {
    const x = d.data();
    const salon = leadNom.get(x.leadId) ?? 'un prospect';
    if (x.type === 'note' && typeof x.body === 'string' && x.body.startsWith('Prospect pris en charge')) {
      pousser('prise', x.authorUid, `a pris en charge « ${salon} »`, x.createdAt?.toDate?.());
    }
    if (x.type === 'note' && typeof x.body === 'string' && x.body.startsWith('Réattribué :')) {
      pousser('prise', x.authorUid, `a réattribué « ${salon} » (${x.body.replace('Réattribué : ', '')})`, x.createdAt?.toDate?.());
    }
    // Seules les étapes qui font avancer méritent le fil (pas le bruit).
    if (x.type === 'changement_etape' && ['demo_realisee', 'essai_cree', 'essai_active', 'payant'].includes(x.stage)) {
      const etapes: Record<string, string> = {
        demo_realisee: 'a fait la démo à',
        essai_cree: 'a fait s’inscrire',
        essai_active: 'a activé le compte de',
        payant: 'a fait passer au payant',
      };
      pousser('etape', x.authorUid, `${etapes[x.stage]} « ${salon} »`, x.createdAt?.toDate?.());
    }
  });

  nouvelles.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({ nouvelles: nouvelles.slice(0, 25) });
}
