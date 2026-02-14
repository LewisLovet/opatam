import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@booking-app/firebase';
import { createBookingSchema } from '@booking-app/shared';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validated = createBookingSchema.parse({
      providerId: body.providerId,
      serviceId: body.serviceId,
      memberId: body.memberId || null,
      locationId: body.locationId,
      datetime: new Date(body.datetime),
      clientInfo: body.clientInfo,
    });

    // Create booking
    // Emails (client confirmation + provider notification) are sent automatically
    // by the onBookingWrite Cloud Function trigger via handleBookingEmails()
    const booking = await bookingService.createBooking(validated);

    return NextResponse.json({ bookingId: booking.id }, { status: 201 });
  } catch (error) {
    console.error('Booking creation error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
