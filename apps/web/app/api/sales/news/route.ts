import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { resolveStaffNames, initialesDe } from '@/lib/staff-names';

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

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  // orderBy single-field (index automatiques) : sans lui, limit(N) rend un
  // sous-ensemble arbitraire — le fil « dernières nouvelles » pouvait rater
  // les vraies dernières. NB : un doc SANS le champ trié serait exclu par
  // Firestore, mais tous ces champs sont posés à la création.
  const [staffSnap, leadsSnap, demosSnap, conversionsSnap, activitesSnap] = await Promise.all([
    db.collection('staffMembers').get(),
    db.collection('salesLeads').orderBy('updatedAt', 'desc').limit(500).get(),
    db.collection('salesDemoLinks').orderBy('createdAt', 'desc').limit(500).get(),
    db.collection('salesConversions').orderBy('firstPaidAt', 'desc').limit(500).get(),
    db.collection('salesActivities').orderBy('createdAt', 'desc').limit(1000).get(),
  ]);

  const fiches = new Map<string, string>();
  staffSnap.docs.forEach((d) => fiches.set(d.id, d.data().displayName ?? '—'));
  // Tous les uids qui apparaissent dans le fil — y compris les admins SANS
  // fiche staff (repli Firebase Auth) : un nom, jamais « Un membre ».
  const uidsVus = new Set<string>();
  const noter = (uid: unknown) => {
    if (typeof uid === 'string' && uid) uidsVus.add(uid);
  };
  leadsSnap.docs.forEach((d) => {
    noter(d.data().ownerUid);
    noter(d.data().pushedBy);
  });
  demosSnap.docs.forEach((d) => noter(d.data().staffUid));
  conversionsSnap.docs.forEach((d) => noter(d.data().staffUid));
  activitesSnap.docs.forEach((d) => noter(d.data().authorUid));
  const annuaire = await resolveStaffNames(fiches, uidsVus);
  const nomDe = (uid: string | null | undefined) =>
    uid ? (annuaire[uid]?.nom ?? 'Un membre') : "L'équipe";
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
