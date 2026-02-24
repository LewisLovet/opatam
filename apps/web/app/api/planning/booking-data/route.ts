import { NextRequest, NextResponse } from 'next/server';
import {
  memberService,
  serviceRepository,
  serviceCategoryRepository,
  availabilityRepository,
  providerRepository,
  locationRepository,
} from '@booking-app/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: "Code d'accès requis" },
        { status: 400 }
      );
    }

    // Validate access code
    const member = await memberService.getMemberByAccessCode(code.toUpperCase());
    if (!member || !member.isActive) {
      return NextResponse.json(
        { error: "Code d'accès invalide" },
        { status: 401 }
      );
    }

    const providerId = member.providerId;

    // Fetch all data in parallel
    const [provider, allServices, serviceCategories, availabilities, locations] =
      await Promise.all([
        providerRepository.getById(providerId),
        serviceRepository.getActiveByProvider(providerId),
        serviceCategoryRepository.getByProvider(providerId),
        availabilityRepository.getByProvider(providerId),
        locationRepository.getActiveByProvider(providerId),
      ]);

    if (!provider) {
      return NextResponse.json(
        { error: 'Prestataire non trouvé' },
        { status: 404 }
      );
    }

    // Filter services accessible by this member
    const services = allServices.filter((s) => {
      // Check memberIds: null/empty means all members, otherwise must include this member
      const memberOk =
        !s.memberIds || s.memberIds.length === 0 || s.memberIds.includes(member.id);

      // Check locationIds: empty means all locations, otherwise must include member's location
      const locationOk =
        s.locationIds.length === 0 || s.locationIds.includes(member.locationId);

      return memberOk && locationOk;
    });

    // Filter availabilities for this member only
    const memberAvailabilities = availabilities.filter(
      (a) => a.memberId === member.id
    );

    // Find member's location
    const memberLocation = locations.find((l) => l.id === member.locationId);

    return NextResponse.json({
      provider: {
        id: provider.id,
        businessName: provider.businessName,
        slug: provider.slug,
        settings: provider.settings,
      },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        duration: s.duration,
        price: s.price,
        bufferTime: s.bufferTime,
        categoryId: s.categoryId ?? null,
      })),
      serviceCategories: serviceCategories
        .filter((c) => c.isActive)
        .map((c) => ({
          id: c.id,
          name: c.name,
          sortOrder: c.sortOrder,
        })),
      member: {
        id: member.id,
        name: member.name,
        locationId: member.locationId,
      },
      location: memberLocation
        ? {
            id: memberLocation.id,
            name: memberLocation.name,
            address: memberLocation.address,
            city: memberLocation.city,
            postalCode: memberLocation.postalCode,
            type: memberLocation.type,
          }
        : null,
      availabilities: memberAvailabilities.map((a) => ({
        memberId: a.memberId,
        dayOfWeek: a.dayOfWeek,
        slots: a.slots,
        isOpen: a.isOpen,
      })),
    });
  } catch (error) {
    console.error('Planning booking-data error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
