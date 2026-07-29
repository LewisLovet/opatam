/**
 * GET /api/calendar/feed/[token] — flux iCalendar du planning d'un pro.
 *
 * C'est l'URL à laquelle le prestataire abonne son agenda. Elle est
 * consultée par Apple Calendar / Google Agenda / Outlook, PAS par un
 * navigateur connecté : il n'y a donc aucune session, et le jeton fait
 * seul office d'autorisation. D'où sa longueur, et le bouton « régénérer »
 * côté application.
 *
 * Le flux sert l'ÉTAT COURANT du planning : les annulations disparaissent
 * simplement de la liste, ce qui les retire de l'agenda au rafraîchissement
 * suivant. Rien à supprimer explicitement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  buildIcsFeed,
  FEED_FUTURE_DAYS,
  FEED_PAST_DAYS,
  type FeedEvent,
} from '@/lib/calendar-feed';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    if (!token || token.length < 24) {
      return new NextResponse('Not found', { status: 404 });
    }

    const db = getAdminFirestore();
    const providers = await db
      .collection('providers')
      .where('calendarFeedToken', '==', token)
      .limit(1)
      .get();

    // 404 volontaire (et non 403) sur un jeton inconnu ou révoqué : on ne
    // confirme jamais l'existence d'un flux à qui n'a pas la bonne clé.
    if (providers.empty) {
      return new NextResponse('Not found', { status: 404 });
    }

    const providerDoc = providers.docs[0];
    const provider = providerDoc.data();

    const now = new Date();
    const from = new Date(now.getTime() - FEED_PAST_DAYS * 86400_000);
    const to = new Date(now.getTime() + FEED_FUTURE_DAYS * 86400_000);

    const snap = await db
      .collection('bookings')
      .where('providerId', '==', providerDoc.id)
      .where('datetime', '>=', from)
      .where('datetime', '<=', to)
      .get();

    const events: FeedEvent[] = [];
    for (const doc of snap.docs) {
      const b = doc.data();
      // Seuls les rendez-vous qui tiennent vraiment. Une résa annulée, en
      // attente de paiement ou en no-show n'a rien à faire dans l'agenda —
      // et son absence du flux la retire côté abonné.
      if (b.status !== 'confirmed') continue;

      const start = b.datetime?.toDate?.();
      const end = b.endDatetime?.toDate?.();
      if (!(start instanceof Date) || Number.isNaN(start.getTime())) continue;
      const safeEnd =
        end instanceof Date && !Number.isNaN(end.getTime()) && end > start
          ? end
          : new Date(start.getTime() + (b.duration ?? 60) * 60_000);

      const clientName = (b.clientInfo?.name as string | undefined)?.trim();
      const serviceName = (b.serviceName as string | undefined)?.trim();
      const memberName = (b.memberName as string | undefined)?.trim();

      const summary = [clientName || 'Réservation', serviceName]
        .filter(Boolean)
        .join(' — ');

      const description = [
        memberName ? `Avec ${memberName}` : null,
        b.clientInfo?.phone ? `Tél. ${b.clientInfo.phone}` : null,
        b.clientInfo?.email ? String(b.clientInfo.email) : null,
        b.notes ? String(b.notes) : null,
      ]
        .filter(Boolean)
        .join('\n');

      events.push({
        // Stable et unique : l'agenda reconnaît le même événement d'un
        // rafraîchissement à l'autre et le met à jour au lieu d'en créer
        // un second.
        uid: `${doc.id}@opatam.com`,
        start,
        end: safeEnd,
        summary,
        description: description || undefined,
        location: (b.locationAddress as string | undefined) || undefined,
      });
    }

    const calendarName = `Opatam — ${(provider.businessName as string) ?? 'Planning'}`;
    const ics = buildIcsFeed(calendarName, events);

    // Trace de consultation : c'est ce qui permet d'afficher au pro
    // « dernière synchronisation il y a X minutes », et de détecter qu'un
    // abonnement a cessé de fonctionner. Best-effort, jamais bloquant.
    providerDoc.ref
      .update({ calendarFeedLastAccessAt: new Date() })
      .catch(() => undefined);

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="opatam.ics"',
        // Jamais de cache intermédiaire : une annulation doit se voir au
        // prochain passage de l'agenda, pas au bon vouloir d'un CDN.
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (e) {
    console.error('[calendar/feed] error:', e);
    return new NextResponse('Internal error', { status: 500 });
  }
}
