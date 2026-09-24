/**
 * Relire un e-mail TEL QU'ENVOYÉ — depuis Resend, à la demande.
 *
 * Le corps n'est pas archivé en base : Resend le garde, et une page de
 * confirmation n'a rien à faire dupliquée dans Firestore. On stocke
 * seulement l'identifiant Resend au moment de l'envoi, et on le relit ici
 * quand un admin clique « Voir ». Réservé aux admins : l'AdminGuard React
 * ne protège que l'interface, `requireAdmin` protège la route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { logId } = await params;
    const db = getAdminFirestore();
    const log = await db.collection('emailLogs').doc(logId).get();
    if (!log.exists) {
      return NextResponse.json({ error: 'Entrée de journal introuvable' }, { status: 404 });
    }

    const resendId = log.data()?.resendId as string | null | undefined;
    if (!resendId) {
      // Envoi en échec, ou journal d'avant Resend : rien à relire.
      return NextResponse.json(
        { error: 'Cet e-mail n’a pas d’identifiant Resend (envoi en échec ?)' },
        { status: 404 },
      );
    }

    const cle = process.env.RESEND_API_KEY;
    if (!cle) {
      return NextResponse.json({ error: 'RESEND_API_KEY absente côté serveur' }, { status: 500 });
    }

    const { data, error } = await new Resend(cle).emails.get(resendId);
    if (error || !data) {
      return NextResponse.json(
        { error: `Resend : ${error?.message ?? 'e-mail introuvable'}` },
        { status: 502 },
      );
    }

    // Accès défensif : le SDK expose ces champs, mais on ne dépend pas de
    // sa forme exacte pour rendre ce qu'on a.
    const d = data as unknown as Record<string, unknown>;
    return NextResponse.json({
      subject: typeof d.subject === 'string' ? d.subject : (log.data()?.subject ?? ''),
      to: Array.isArray(d.to) ? d.to : (log.data()?.to ?? []),
      html: typeof d.html === 'string' ? d.html : null,
      text: typeof d.text === 'string' ? d.text : null,
      lastEvent: typeof d.last_event === 'string' ? d.last_event : null,
      createdAt: typeof d.created_at === 'string' ? d.created_at : null,
    });
  } catch (error) {
    console.error('[admin/emails/:id] erreur :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
