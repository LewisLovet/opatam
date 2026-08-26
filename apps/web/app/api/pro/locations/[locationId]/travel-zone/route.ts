import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { resolvePlace } from '@/lib/google-places';
import { travelZoneTiersSchema } from '@booking-app/shared';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

/**
 * Zone de déplacement d'un lieu mobile — la SEULE écriture autorisée.
 *
 * Les documents lieux sont en lecture publique : les PALIERS (tarifs) y
 * vivent, mais l'ORIGINE des trajets (où habite/démarre le pro) est un
 * sous-document Admin-only `locations/{id}/private/travelOrigin`, jamais
 * exposé. Au passage, cette route PURGE les champs publics sensibles d'un
 * lieu mobile (address, postalCode, geopoint) — y compris pour les lieux
 * existants resauvegardés.
 *
 * PUT  { originPlaceId, tiers }  → configure (résout l'origine côté serveur)
 * PUT  { originPlaceId: null, tiers: null } → désactive (efface zone + origine)
 * GET  → { tiers, origin: { address } } pour hydrater les éditeurs.
 */

const putSchema = z.object({
  originPlaceId: z.string().min(5).max(300).nullable(),
  tiers: travelZoneTiersSchema.nullable(),
});

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const uid = await authenticate(request);
  if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { locationId } = await params;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Requête invalide' },
      { status: 400 },
    );
  }
  const { originPlaceId, tiers } = parsed.data;
  // Tout ou rien : une zone sans origine ne peut pas calculer de distance.
  if ((tiers === null) !== (originPlaceId === null)) {
    return NextResponse.json(
      { error: 'Origine et paliers se configurent ensemble' },
      { status: 400 },
    );
  }

  const db = getAdminFirestore();
  const locationRef = db
    .collection('providers')
    .doc(uid)
    .collection('locations')
    .doc(locationId);
  const locationSnap = await locationRef.get();
  if (!locationSnap.exists) {
    return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 });
  }
  const location = locationSnap.data()!;
  const originRef = locationRef.collection('private').doc('travelOrigin');

  if (tiers === null) {
    await Promise.all([
      locationRef.update({
        travelZone: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
      originRef.delete(),
    ]);
    return NextResponse.json({ ok: true, tiers: null });
  }

  if (location.type !== 'mobile') {
    return NextResponse.json(
      { error: 'Les frais de déplacement ne concernent que les lieux mobiles' },
      { status: 400 },
    );
  }

  let origin;
  try {
    origin = await resolvePlace(originPlaceId!);
  } catch (e) {
    console.error('[travel-zone] resolvePlace:', e);
    return NextResponse.json(
      { error: "Impossible de résoudre l'adresse de départ — réessayez" },
      { status: 502 },
    );
  }

  await Promise.all([
    // L'origine EXACTE, Admin-only.
    originRef.set({
      geopoint: origin.geopoint,
      address: origin.formattedAddress,
      placeId: origin.placeId,
      city: origin.city,
      countryCode: origin.countryCode,
      updatedAt: FieldValue.serverTimestamp(),
    }),
    // Le doc public : paliers + purge des champs sensibles d'un lieu mobile.
    locationRef.update({
      travelZone: tiers,
      travelRadius: tiers[tiers.length - 1].maxKm, // cohérence de l'affichage public
      address: '',
      postalCode: '',
      geopoint: null,
      city: location.city || origin.city,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  ]);

  return NextResponse.json({ ok: true, tiers, origin: { address: origin.formattedAddress } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const uid = await authenticate(request);
  if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { locationId } = await params;

  const db = getAdminFirestore();
  const locationRef = db
    .collection('providers')
    .doc(uid)
    .collection('locations')
    .doc(locationId);
  const [locationSnap, originSnap] = await Promise.all([
    locationRef.get(),
    locationRef.collection('private').doc('travelOrigin').get(),
  ]);
  if (!locationSnap.exists) {
    return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 });
  }

  const origin = originSnap.data();
  return NextResponse.json({
    tiers: locationSnap.data()?.travelZone ?? null,
    origin: origin ? { address: origin.address, placeId: origin.placeId } : null,
  });
}
