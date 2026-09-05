// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { schedulingService } from '@booking-app/firebase';

/**
 * Résumé de disponibilités par jour (statut + capacité + créneaux) — le
 * pendant serveur de `schedulingService.getAvailabilitySummary`, pour le
 * tunnel client MOBILE.
 *
 * Raison d'être : le moteur de créneaux matérialise les horaires du salon
 * avec les composantes locales de la machine qui l'exécute (`setHours`).
 * Exécuté SUR le téléphone d'une cliente dans un autre fuseau (Guadeloupe,
 * UTC−4…), il générait des créneaux décalés de plusieurs heures — envoyés
 * tels quels à /api/bookings, donc des réservations à la mauvaise heure
 * dans l'agenda du pro. Ici le calcul tourne côté serveur en Europe/Paris,
 * comme /api/slots pour le tunnel web ; le téléphone ne reçoit que des
 * instants absolus (ISO) et des libellés d'heure du salon.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('providerId');
    const serviceId = searchParams.get('serviceId');
    const memberId = searchParams.get('memberId');
    if (!providerId || !serviceId || !memberId) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Bornes en JOURS calendaires du salon (YYYY-MM-DD), jamais en instants :
    // un ISO minuit-local d'un téléphone UTC−4 désignerait le mauvais jour.
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    const dayKey = /^\d{4}-\d{2}-\d{2}$/;
    if (!startStr || !endStr || !dayKey.test(startStr) || !dayKey.test(endStr)) {
      return NextResponse.json(
        { error: 'Paramètres start/end requis (YYYY-MM-DD)' },
        { status: 400 },
      );
    }
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 });
    }

    const durationParam = searchParams.get('duration');
    const durationOverride = durationParam ? parseInt(durationParam, 10) : undefined;
    const extraParam = searchParams.get('extraServiceIds');
    const extraServiceIds = extraParam ? extraParam.split(',').filter(Boolean) : undefined;

    const days = await schedulingService.getAvailabilitySummary({
      providerId,
      serviceId,
      memberId,
      startDate,
      endDate,
      durationOverride:
        durationOverride && Number.isFinite(durationOverride) ? durationOverride : undefined,
      extraServiceIds,
    });

    return NextResponse.json({
      days: days.map((d) => ({
        date: d.date, // YYYY-MM-DD (jour du salon)
        status: d.status,
        capacity: d.capacity,
        slots: d.slots.map((s) => ({
          date: s.date.toISOString(),
          start: s.start, // "HH:MM" — heure du salon, à afficher tel quel
          end: s.end,
          datetime: s.datetime.toISOString(),
          endDatetime: s.endDatetime.toISOString(),
        })),
      })),
    });
  } catch (error) {
    console.error('Availability summary fetch error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}
