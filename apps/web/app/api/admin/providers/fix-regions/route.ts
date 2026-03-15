import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists && userDoc.data()?.isAdmin === true;
}

/**
 * Lookup region from city name using the French government address API
 */
async function lookupRegionFromCity(city: string): Promise<string | null> {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(city)}&type=municipality&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    // context format: "75, Paris, Île-de-France"
    const contextParts = (feature.properties.context || '').split(', ');
    if (contextParts.length >= 3) {
      return contextParts[contextParts.length - 1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/providers/fix-regions
 * Body: { providerId?: string }
 * - If providerId is provided: fix region for that single provider
 * - If no providerId: fix all providers with null/missing region
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!(await verifyAdmin(adminUid))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const db = getAdminFirestore();

    // Single provider fix
    if (body.providerId) {
      const result = await fixProviderRegion(db, body.providerId);
      return NextResponse.json(result);
    }

    // Bulk fix: all providers with missing region
    const providersSnap = await db.collection('providers').get();
    const toFix = providersSnap.docs.filter((doc) => {
      const data = doc.data();
      return !data.region;
    });

    let fixed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in batches of 5 to respect API rate limits
    for (let i = 0; i < toFix.length; i += 5) {
      const batch = toFix.slice(i, i + 5);
      const results = await Promise.all(
        batch.map((doc) => fixProviderRegion(db, doc.id))
      );
      for (const r of results) {
        if (r.fixed) fixed++;
        else if (r.error) {
          skipped++;
          errors.push(`${r.providerId}: ${r.error}`);
        } else {
          skipped++;
        }
      }
    }

    return NextResponse.json({
      total: toFix.length,
      fixed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[admin/providers/fix-regions] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

async function fixProviderRegion(
  db: FirebaseFirestore.Firestore,
  providerId: string
): Promise<{ providerId: string; fixed: boolean; region?: string; error?: string }> {
  try {
    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return { providerId, fixed: false, error: 'Provider introuvable' };
    }

    // Get the primary (default) location, or fall back to first active location
    const locationsSnap = await db
      .collection('providers')
      .doc(providerId)
      .collection('locations')
      .where('isActive', '==', true)
      .get();

    if (locationsSnap.empty) {
      return { providerId, fixed: false, error: 'Aucun lieu actif' };
    }

    const defaultLoc = locationsSnap.docs.find((d) => d.data().isDefault) || locationsSnap.docs[0];
    const city = defaultLoc.data().city;

    if (!city) {
      return { providerId, fixed: false, error: 'Lieu sans ville' };
    }

    const region = await lookupRegionFromCity(city);
    if (!region) {
      return { providerId, fixed: false, error: `Région introuvable pour "${city}"` };
    }

    await db.collection('providers').doc(providerId).update({
      region,
      updatedAt: new Date(),
    });

    return { providerId, fixed: true, region };
  } catch (err: any) {
    return { providerId, fixed: false, error: err.message };
  }
}
