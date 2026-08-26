/**
 * Recherche d'adresse partagée (Google Places v2 + repli BAN France) —
 * extraite de (pro)/locations.tsx et (auth)/pro.tsx qui la dupliquaient.
 *
 * Pour l'adresse d'une CLIENTE (frais de déplacement), n'utiliser QUE les
 * suggestions Google (placeId non vide) : le serveur ne fait foi que d'un
 * placeId qu'il résout lui-même — le repli BAN n'en fournit pas.
 */

export interface AddressSuggestion {
  label: string;
  name: string;
  city: string;
  postcode: string;
  coordinates: { latitude: number; longitude: number } | null;
  placeId: string;
}

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export async function searchAddress(
  query: string,
  countryCode: string = 'fr',
  limit = 5,
): Promise<AddressSuggestion[]> {
  if (GOOGLE_API_KEY) {
    try {
      const body = {
        input: query,
        includedRegionCodes: [countryCode.toLowerCase()],
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route', 'locality'],
      };
      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (response.ok) {
        const json = await response.json();
        const results = (json.suggestions ?? []).slice(0, limit).map((s: any) => ({
          label: s.placePrediction?.text?.text ?? '',
          name: s.placePrediction?.structuredFormat?.mainText?.text ?? '',
          city: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
          postcode: '',
          coordinates: null,
          placeId: s.placePrediction?.placeId ?? '',
        }));
        if (results.length > 0) return results;
      }
    } catch {
      /* fall through to BAN */
    }
  }
  // Fallback BAN (France only) — pas de placeId : inutilisable pour les
  // frais de déplacement, gardé pour les formulaires pro.
  if (countryCode.toLowerCase() !== 'fr') return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`https://api-adresse.data.gouv.fr/search?${params}`);
  if (!response.ok) return [];
  const json = await response.json();
  return (json.features ?? []).map((f: any) => ({
    label: f.properties.label,
    name: f.properties.name,
    city: f.properties.city,
    postcode: f.properties.postcode,
    coordinates: { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] },
    placeId: '',
  }));
}

export async function fetchPlaceDetails(placeId: string): Promise<{
  city: string;
  postcode: string;
  region: string;
  coordinates: { latitude: number; longitude: number } | null;
  formattedAddress: string;
} | null> {
  if (!GOOGLE_API_KEY || !placeId) return null;
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?key=${GOOGLE_API_KEY}&fields=formattedAddress,addressComponents,location,id`,
  );
  if (!response.ok) return null;
  const place = await response.json();
  const components: any[] = place.addressComponents ?? [];
  const getComp = (type: string) => components.find((c: any) => c.types?.includes(type));
  const locality = getComp('locality') ?? getComp('postal_town') ?? getComp('administrative_area_level_3');
  const postalCode = getComp('postal_code');
  const adminArea1 = getComp('administrative_area_level_1');
  return {
    city: locality?.longText ?? '',
    region: adminArea1?.longText ?? '',
    postcode: postalCode?.longText ?? '',
    formattedAddress: place.formattedAddress ?? '',
    coordinates: place.location
      ? { latitude: place.location.latitude, longitude: place.location.longitude }
      : null,
  };
}
