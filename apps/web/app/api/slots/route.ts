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

    if (dateStr) {
      // New format: YYYY-MM-DD — parse as local midnight to avoid timezone shift
      const [y, m, d] = dateStr.split('-').map(Number);
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

    // Get available slots
    const slots = await schedulingService.getAvailableSlots({
      providerId,
      serviceId,
      memberId,
      startDate,
      endDate,
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
