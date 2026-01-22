import { NextRequest, NextResponse } from 'next/server';
import { schedulingService } from '@booking-app/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('providerId');
    const serviceId = searchParams.get('serviceId');
    const memberId = searchParams.get('memberId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Validate required parameters
    if (!providerId || !serviceId || !memberId || !startDateStr || !endDateStr) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

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
