import { NextRequest, NextResponse } from 'next/server';
import { bookingRepository } from '@booking-app/firebase';
import { appConfig } from '@/lib/resend';

interface RouteParams {
  params: Promise<{ bookingId: string }>;
}

/**
 * Generate ICS file for a booking
 * GET /api/calendar/[bookingId]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  console.log('[CALENDAR-ICS] ========== START ==========');

  try {
    const { bookingId } = await params;
    console.log('[CALENDAR-ICS] Requested bookingId:', bookingId);

    // Get booking
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      console.log('[CALENDAR-ICS] ERROR: Booking not found');
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }
    console.log('[CALENDAR-ICS] Booking found:', {
      serviceName: booking.serviceName,
      providerName: booking.providerName,
      cancelToken: booking.cancelToken ? 'EXISTS' : 'NOT SET',
    });

    // Format dates for ICS (YYYYMMDDTHHmmssZ format)
    const formatIcsDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const startDate = new Date(booking.datetime);
    const endDate = new Date(booking.endDatetime);

    // Escape special characters for ICS (RFC 5545)
    const escapeIcs = (str: string) =>
      str
        .replace(/\\/g, '\\\\')  // Backslashes first
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');  // Real newlines to escaped

    // Build description with cancel link
    const cancelUrl = booking.cancelToken
      ? `${appConfig.url}/reservation/annuler/${booking.cancelToken}`
      : null;

    const descriptionParts = [
      booking.memberName ? `Avec ${booking.memberName}` : `Chez ${booking.providerName}`,
    ];
    if (cancelUrl) {
      descriptionParts.push('');
      descriptionParts.push(`Pour annuler : ${cancelUrl}`);
    }
    const description = escapeIcs(descriptionParts.join('\n'));

    console.log('[CALENDAR-ICS] Generated cancel URL:', cancelUrl || 'NONE');
    console.log('[CALENDAR-ICS] Description (escaped):', description);

    // Build ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Opatam//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${bookingId}@opatam.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:RDV - ${escapeIcs(booking.serviceName)} chez ${escapeIcs(booking.providerName)}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${escapeIcs(booking.locationAddress || '')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    console.log('[CALENDAR-ICS] SUCCESS - Returning ICS file');
    console.log('[CALENDAR-ICS] ========== END ==========');

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="rendez-vous-${bookingId}.ics"`,
      },
    });
  } catch (error) {
    console.error('[CALENDAR-ICS] EXCEPTION:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
