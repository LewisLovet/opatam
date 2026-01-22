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
    const booking = await bookingService.createBooking(validated);

    // Send confirmation email (fire and forget)
    try {
      const emailResponse = await fetch(
        new URL('/api/bookings/confirmation-email', request.url).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: booking.clientInfo.email,
            clientName: booking.clientInfo.name,
            serviceName: booking.serviceName,
            datetime: booking.datetime.toISOString(),
            duration: booking.duration,
            price: booking.price,
            providerName: booking.providerName,
            providerSlug: body.providerSlug,
            locationName: booking.locationName,
            locationAddress: booking.locationAddress,
            memberName: booking.memberName,
          }),
        }
      );

      if (!emailResponse.ok) {
        console.error('Failed to send confirmation email:', await emailResponse.text());
      }
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

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
