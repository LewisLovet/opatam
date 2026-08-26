import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { resolvePlace } from '@/lib/google-places';
import { computeTravelQuote, signTravelQuote } from '@/lib/travel';
import { MapboxUnavailableError } from '@/lib/mapbox';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

/**
 * Devis de frais de déplacement — appelé par les tunnels (web, embed, mobile)
 * quand la cliente sélectionne son adresse pour un lieu mobile à zone
 * configurée.
 *
 * Anti-abus : déclenché par une SÉLECTION d'autocomplete (pas à la frappe),
 * rate-limité par IP, et tous les secrets restent serveur. La réponse inclut
 * un devis signé (15 min) que la création consommera sans recalcul.
 *
 * Hors zone : renvoie les AUTRES lieux actifs du pro qui proposent TOUTES
 * les prestations demandées (sinon la suggestion mènerait à une impasse).
 */

const bodySchema = z.object({
  providerId: z.string().min(1),
  locationId: z.string().min(1),
  placeId: z.string().min(5).max(300),
  serviceIds: z.array(z.string().min(1)).max(20).default([]),
});

export async function POST(request: NextRequest) {
  if (!checkRateLimit('travel-quote', request, { max: 30, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'Trop de requêtes — réessayez dans quelques minutes' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const { providerId, locationId, placeId, serviceIds } = parsed.data;

  const db = getAdminFirestore();
  const locationRef = db
    .collection('providers')
    .doc(providerId)
    .collection('locations')
    .doc(locationId);
  const [locationSnap, originSnap] = await Promise.all([
    locationRef.get(),
    locationRef.collection('private').doc('travelOrigin').get(),
  ]);
  if (!locationSnap.exists) {
    return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 });
  }

  const location = locationSnap.data()!;
  const tiers = location.travelZone;
  const origin = originSnap.data();
  if (
    location.type !== 'mobile' ||
    !Array.isArray(tiers) ||
    tiers.length === 0 ||
    !origin?.geopoint
  ) {
    // Pas de zone configurée : le tunnel n'affiche rien, comportement historique.
    return NextResponse.json({ applicable: false });
  }

  let place;
  try {
    place = await resolvePlace(placeId);
  } catch (e) {
    console.error('[travel/quote] resolvePlace:', e);
    return NextResponse.json(
      { error: "Adresse introuvable — sélectionnez-la dans les suggestions", code: 'PLACE_UNRESOLVED' },
      { status: 400 },
    );
  }

  try {
    const quote = await computeTravelQuote(locationId, origin.geopoint, tiers, place.geopoint);

    if (!quote.inZone) {
      return NextResponse.json({
        applicable: true,
        inZone: false,
        maxKm: quote.maxKm,
        alternativeLocations: await findAlternativeLocations(db, providerId, locationId, serviceIds),
      });
    }

    return NextResponse.json({
      applicable: true,
      inZone: true,
      fee: quote.fee,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
      city: place.city,
      quoteToken: signTravelQuote({
        locationId,
        placeId: place.placeId,
        fee: quote.fee!,
        distanceKm: quote.distanceKm!,
        durationMin: quote.durationMin,
        clientCity: place.city,
      }),
    });
  } catch (e) {
    if (e instanceof MapboxUnavailableError) {
      console.error('[travel/quote] Mapbox indisponible:', e.message);
      return NextResponse.json(
        { error: 'Vérification de la distance impossible — réessayez dans quelques minutes', code: 'TRAVEL_UNAVAILABLE' },
        { status: 503 },
      );
    }
    throw e;
  }
}

/**
 * Les autres lieux ACTIFS du pro où toutes les prestations demandées sont
 * réservables — pour que la suggestion hors zone ne mène pas à une impasse.
 */
async function findAlternativeLocations(
  db: FirebaseFirestore.Firestore,
  providerId: string,
  excludeLocationId: string,
  serviceIds: string[],
): Promise<Array<{ id: string; name: string; city: string; type: string }>> {
  const [locationsSnap, servicesSnap] = await Promise.all([
    db.collection('providers').doc(providerId).collection('locations').get(),
    serviceIds.length > 0
      ? db.collection('providers').doc(providerId).collection('services').get()
      : Promise.resolve(null),
  ]);

  // locationIds vide/absent sur une prestation = disponible partout.
  const requested = servicesSnap
    ? servicesSnap.docs.filter((d) => serviceIds.includes(d.id)).map((d) => d.data())
    : [];

  return locationsSnap.docs
    .filter((doc) => {
      if (doc.id === excludeLocationId) return false;
      const data = doc.data();
      if (data.isActive === false) return false;
      return requested.every((svc) => {
        const ids = svc.locationIds;
        return !Array.isArray(ids) || ids.length === 0 || ids.includes(doc.id);
      });
    })
    .slice(0, 5)
    .map((doc) => {
      const data = doc.data();
      return { id: doc.id, name: data.name ?? '', city: data.city ?? '', type: data.type ?? 'fixed' };
    });
}
