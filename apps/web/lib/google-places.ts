/**
 * Résolution serveur d'un placeId Google — la SEULE source de vérité pour
 * l'adresse d'une cliente (prestation à domicile) et l'origine d'un lieu
 * mobile. On n'accepte JAMAIS des coordonnées ou un texte d'adresse envoyés
 * par le client : un placeId se résout ici, avec la clé serveur.
 */

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export interface ResolvedPlace {
  placeId: string;
  formattedAddress: string;
  city: string;
  postalCode: string;
  countryCode: string; // ISO 3166-1 alpha-2, majuscules
  geopoint: { latitude: number; longitude: number };
}

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function componentOf(components: AddressComponent[], type: string): AddressComponent | undefined {
  return components.find((c) => c.types?.includes(type));
}

/**
 * Résout un placeId en adresse structurée + coordonnées. Throw si la clé est
 * absente, le placeId inconnu ou la réponse inexploitable — l'appelant
 * traduit en 4xx/5xx selon le contexte.
 */
export async function resolvePlace(placeId: string): Promise<ResolvedPlace> {
  if (!GOOGLE_API_KEY) throw new Error('Clé Google Maps serveur manquante');

  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location',
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`Google Place Details HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    id?: string;
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
    location?: { latitude?: number; longitude?: number };
  };
  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('Place sans coordonnées');
  }

  const components = data.addressComponents ?? [];
  const city =
    componentOf(components, 'locality')?.longText ??
    componentOf(components, 'postal_town')?.longText ??
    componentOf(components, 'administrative_area_level_2')?.longText ??
    '';
  const countryCode = (componentOf(components, 'country')?.shortText ?? '').toUpperCase();

  return {
    placeId: data.id ?? placeId,
    formattedAddress: data.formattedAddress ?? '',
    city,
    postalCode: componentOf(components, 'postal_code')?.longText ?? '',
    countryCode,
    geopoint: { latitude: lat, longitude: lng },
  };
}
