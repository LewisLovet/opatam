// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { schedulingService } from '@booking-app/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('providerId');
    const serviceId = searchParams.get('serviceId');
    const memberId = searchParams.get('memberId');

    if (!providerId || !serviceId || !memberId) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    // Support both new `date` param (YYYY-MM-DD, timezone-safe) and legacy startDate/endDate
    const dateStr = searchParams.get('date');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    let startDate: Date;
    let endDate: Date;
    // Journées calendaires demandées — voir la note à l'appel du moteur.
    let startDay: string | undefined;
    let endDay: string | undefined;

    if (dateStr) {
      // New format: YYYY-MM-DD — parse as local midnight
      // Server timezone is forced to Europe/Paris via next.config.ts
      const [y, m, d] = dateStr.split('-').map(Number);
      startDay = dateStr;
      endDay = dateStr;
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
    } else {
      return NextResponse.json(
        { error: 'Paramètre date ou startDate/endDate requis' },
        { status: 400 }
      );
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Dates invalides' },
        { status: 400 }
      );
    }

    // Effective total slot length (service + variations/options + buffer),
    // sent by the booking flow when the service has variations.
    const durationParam = searchParams.get('duration');
    const durationOverride = durationParam ? parseInt(durationParam, 10) : undefined;

    // Get available slots
    const slots = await schedulingService.getAvailableSlots({
      providerId,
      serviceId,
      memberId,
      // Les JOURNÉES demandées, telles quelles. Les `startDate`/`endDate`
      // ci-dessus sont construites en heure du SERVEUR (Paris) : les laisser
      // seules ferait redéduire au moteur une date locale du LIEU, et
      // « 23 septembre 23:59 à Paris » tombe le 24 à La Réunion, tandis que
      // « 23 septembre 00:00 » tombe le 22 à New York. Une date calendaire
      // n'a pas de fuseau : elle traverse intacte.
      startDay,
      endDay,
      startDate,
      endDate,
      durationOverride:
        durationOverride && Number.isFinite(durationOverride)
          ? durationOverride
          : undefined,
    });

    // Serialize slots for client
    const serializedSlots = slots.map((slot) => ({
      date: slot.date.toISOString(),
      start: slot.start,
      end: slot.end,
      datetime: slot.datetime.toISOString(),
      endDatetime: slot.endDatetime.toISOString(),
    }));

    return NextResponse.json({ slots: serializedSlots });
  } catch (error) {
    console.error('Slots fetch error:', error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
