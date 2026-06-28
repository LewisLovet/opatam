// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { schedulingService } from '@booking-app/firebase';

/**
 * GET /api/slots/occupancy
 *
 * Service-AGNOSTIC per-day occupancy for the provider month agenda (no service
 * picked). Returns each day's status (available / almost_full / full / closed)
 * derived from how much of the member's open hours is taken by bookings ∪
 * blocks. One batched call (3 reads) for the whole range. Short cache.
 *
 * Query: providerId, memberId, from=YYYY-MM-DD, to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('providerId');
    const memberId = searchParams.get('memberId');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!providerId || !memberId || !fromStr || !toStr) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Parse YYYY-MM-DD as local midnight (server forced to Europe/Paris).
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const startDate = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const endDate = new Date(ty, tm - 1, td, 23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) {
      return NextResponse.json({ error: 'Dates invalides' }, { status: 400 });
    }

    const days = await schedulingService.getOccupancySummary({
      providerId,
      memberId,
      startDate,
      endDate,
    });

    const res = NextResponse.json({ days });
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=30');
    return res;
  } catch (error) {
    console.error('Occupancy summary error:', error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}
