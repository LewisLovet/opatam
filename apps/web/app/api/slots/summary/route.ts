// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { schedulingService } from '@booking-app/firebase';

/**
 * GET /api/slots/summary
 *
 * Per-day availability for the booking calendar over a date range, in ONE
 * batched call. Returns each day's status (available / almost_full / full /
 * closed) + realistic capacity + the selectable slots (so a day opens
 * instantly, no per-day fetch). Short cache only — the final booking always
 * re-validates live, so a slightly stale slot can never double-book.
 *
 * Query: providerId, serviceId, memberId, from=YYYY-MM-DD, to=YYYY-MM-DD,
 *        duration (optional effective length incl. variations/options + buffer)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('providerId');
    const serviceId = searchParams.get('serviceId');
    const memberId = searchParams.get('memberId');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!providerId || !serviceId || !memberId || !fromStr || !toStr) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Parse YYYY-MM-DD as local midnight (server forced to Europe/Paris) to
    // avoid the UTC shift toISOString would introduce.
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const startDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const endDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 });
    }

    const durationParam = searchParams.get('duration');
    const durationOverride = durationParam ? parseInt(durationParam, 10) : undefined;

    const days = await schedulingService.getAvailabilitySummary({
      providerId,
      serviceId,
      memberId,
      startDate,
      endDate,
      durationOverride:
        durationOverride && Number.isFinite(durationOverride) ? durationOverride : undefined,
    });

    const serialized = days.map((d) => ({
      date: d.date,
      status: d.status,
      capacity: d.capacity,
      slots: d.slots.map((s) => ({
        date: s.date.toISOString(),
        start: s.start,
        end: s.end,
        datetime: s.datetime.toISOString(),
        endDatetime: s.endDatetime.toISOString(),
      })),
    }));

    // Short cache: keeps month navigation snappy without serving stale day
    // states for long. The booking creation re-validates live anyway.
    const res = NextResponse.json({ days: serialized });
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=30');
    return res;
  } catch (error) {
    console.error('Slots summary error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}
