import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

/**
 * Fin de rendez-vous (mode rendez-vous de la bibliothèque) — la COLLECTE
 * silencieuse de la boucle « argumenter → mesurer » : quel argument a porté,
 * quelle objection est tombée, quel résultat.
 *
 * On collecte dès maintenant, on n'analysera qu'avec du volume : aucun
 * tableau de bord ne lit encore salesMeetings, et c'est voulu — des
 * conclusions sur 15 points de données seraient du bruit déguisé en science.
 *
 * Le journal du prospect (salesActivities) est écrit dans la MÊME
 * transaction que le compte rendu — cohérence du fil, comme le claim.
 */

const meetingSchema = z.object({
  leadId: z.string().min(1).nullable().optional(),
  competitor: z.string().min(1).max(60),
  reponses: z
    .object({
      probleme: z.string().max(300).optional().default(''),
      prixEuros: z.number().min(0).max(2000).nullable().optional(),
      equipe: z.boolean().optional().default(false),
      sourceClientes: z.string().max(60).optional().default(''),
      objectionsCochees: z.array(z.string().max(200)).max(12).optional().default([]),
    })
    .optional()
    .default({}),
  argumentUtilise: z.string().max(300).optional().default(''),
  objectionPrincipale: z.string().max(200).optional().default(''),
  resultat: z.enum(['tres_interesse', 'a_relancer', 'hesitant', 'refus']).nullable().optional(),
  prochaineEtape: z.string().max(300).optional().default(''),
});

const RESULTAT_LABELS: Record<string, string> = {
  tres_interesse: 'très intéressé',
  a_relancer: 'à relancer',
  hesitant: 'hésitant',
  refus: 'refus',
};

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const parsed = meetingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const db = getAdminFirestore();
  // Un rendez-vous ne se journalise que sur SON prospect (ou en manager).
  const erreur = await db.runTransaction(async (tx) => {
    if (d.leadId) {
      const leadSnap = await tx.get(db.collection('salesLeads').doc(d.leadId));
      if (!leadSnap.exists) return { status: 404, message: 'Prospect introuvable' };
      if (auth.identity.role === 'sales' && leadSnap.data()?.ownerUid !== auth.identity.uid) {
        return { status: 403, message: 'Ce prospect ne vous appartient pas' };
      }
    }
    tx.set(db.collection('salesMeetings').doc(), {
      staffUid: auth.identity.uid,
      leadId: d.leadId ?? null,
      competitor: d.competitor,
      reponses: d.reponses,
      argumentUtilise: d.argumentUtilise,
      objectionPrincipale: d.objectionPrincipale,
      resultat: d.resultat ?? null,
      prochaineEtape: d.prochaineEtape,
      createdAt: FieldValue.serverTimestamp(),
    });
    if (d.leadId) {
      const morceaux = [
        `Rendez-vous (mode préparé, face à ${d.competitor})`,
        d.resultat ? `résultat : ${RESULTAT_LABELS[d.resultat]}` : null,
        d.argumentUtilise ? `argument : ${d.argumentUtilise.slice(0, 120)}` : null,
        d.objectionPrincipale ? `objection : ${d.objectionPrincipale.slice(0, 120)}` : null,
        d.prochaineEtape ? `prochaine étape : ${d.prochaineEtape.slice(0, 120)}` : null,
      ].filter(Boolean);
      tx.set(db.collection('salesActivities').doc(), {
        leadId: d.leadId,
        authorUid: auth.identity.uid,
        type: 'appel',
        stage: null,
        body: morceaux.join(' — '),
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(db.collection('salesLeads').doc(d.leadId), {
        lastInteractionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return null;
  });
  if (erreur) return NextResponse.json({ error: erreur.message }, { status: erreur.status });

  return NextResponse.json({ ok: true });
}
