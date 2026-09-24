/**
 * Journal des e-mails d'une réservation — lecture admin.
 *
 * Lit `emailLogs` par `bookingId`. Pas de `orderBy` dans la requête : ça
 * exigerait un index composite (bookingId + sentAt) pour trier une poignée
 * de documents. Égalité en base, tri en mémoire — même règle qu'ailleurs
 * dans l'admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const bookingId = request.nextUrl.searchParams.get('bookingId');
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('emailLogs').where('bookingId', '==', bookingId).get();

    const items = snap.docs
      .map((doc) => {
        const d = doc.data();
        const sentAt = d.sentAt?.toDate?.() as Date | undefined;
        return {
          id: doc.id,
          type: d.type ?? 'inconnu',
          to: Array.isArray(d.to) ? d.to : [],
          subject: d.subject ?? '',
          bookingId: d.bookingId ?? null,
          providerId: d.providerId ?? null,
          locale: d.locale ?? null,
          resume: d.resume ?? null,
          resendId: d.resendId ?? null,
          status: d.status === 'failed' ? 'failed' : 'sent',
          error: d.error ?? null,
          sentAt: sentAt ? sentAt.toISOString() : null,
        };
      })
      .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[admin/emails] erreur :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
