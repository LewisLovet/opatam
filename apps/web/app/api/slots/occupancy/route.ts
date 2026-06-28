// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { schedulingService, memberRepository } from '@booking-app/firebase';

const STATUS_RANK: Record<string, number> = { closed: 0, full: 1, almost_full: 2, available: 3 };

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

    if (!providerId || !fromStr || !toStr) {
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

    type Day = Awaited<ReturnType<typeof schedulingService.getOccupancySummary>>[number];

    let days: Day[];
    if (memberId) {
      days = await schedulingService.getOccupancySummary({ providerId, memberId, startDate, endDate });
    } else {
      // No member → aggregate across the whole team: best status per day
      // (available > almost_full > full > closed), most-free member's minutes.
      const members = (await memberRepository.getByProvider(providerId)).filter(
        (m) => m.isActive !== false,
      );
      const acc = new Map<string, Day>();
      for (const m of members) {
        const ds = await schedulingService.getOccupancySummary({
          providerId,
          memberId: m.id,
          startDate,
          endDate,
        });
        for (const d of ds) {
          const cur = acc.get(d.date);
          if (!cur || (STATUS_RANK[d.status] ?? 0) > (STATUS_RANK[cur.status] ?? 0)) {
            acc.set(d.date, { ...d });
          } else {
            cur.freeMinutes = Math.max(cur.freeMinutes, d.freeMinutes);
            cur.openMinutes = Math.max(cur.openMinutes, d.openMinutes);
          }
        }
      }
      days = Array.from(acc.values());
    }

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
