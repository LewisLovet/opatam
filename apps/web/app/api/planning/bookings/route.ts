import { NextRequest, NextResponse } from 'next/server';
import {
  memberService,
  bookingRepository,
  providerRepository,
} from '@booking-app/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get('code');
    if (!code) {
      return NextResponse.json(
        { error: 'Code d\'accès requis' },
        { status: 400 }
      );
    }

    // Validate access code
    const member = await memberService.getMemberByAccessCode(code.toUpperCase());
    if (!member || !member.isActive) {
      return NextResponse.json(
        { error: 'Code d\'accès invalide' },
        { status: 401 }
      );
    }

    // Get provider info
    const provider = await providerRepository.getById(member.providerId);
    if (!provider) {
      return NextResponse.json(
        { error: 'Prestataire non trouvé' },
        { status: 404 }
      );
    }

    // Get bookings for this member
    const allBookings = await bookingRepository.getByMember(member.providerId, member.id);

    // Filter: only upcoming + confirmed/pending, sorted by datetime asc
    const now = new Date();
    const upcomingBookings = allBookings
      .filter((b) => b.datetime >= now && (b.status === 'confirmed' || b.status === 'pending'))
      .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    // Also get today's bookings (even if started)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayBookings = allBookings
      .filter(
        (b) =>
          b.datetime >= startOfToday &&
          b.datetime < now &&
          (b.status === 'confirmed' || b.status === 'pending')
      )
      .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    const bookings = [...todayBookings, ...upcomingBookings];

    // Serialize for client
    const serializedBookings = bookings.map((b) => ({
      id: b.id,
      serviceName: b.serviceName,
      duration: b.duration,
      price: b.price,
      clientInfo: {
        name: b.clientInfo.name,
        email: b.clientInfo.email,
        phone: b.clientInfo.phone,
      },
      datetime: b.datetime.toISOString(),
      endDatetime: b.endDatetime.toISOString(),
      status: b.status,
      locationName: b.locationName,
      locationAddress: b.locationAddress,
    }));

    return NextResponse.json({
      member: {
        name: member.name,
        email: member.email,
      },
      businessName: provider.businessName,
      slug: provider.isPublished ? provider.slug : null,
      bookings: serializedBookings,
    });
  } catch (error) {
    console.error('Planning bookings error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
