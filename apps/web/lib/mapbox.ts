/**
 * Mapbox Directions — distance routière entre l'origine d'un lieu mobile et
 * l'adresse de la cliente. Serveur UNIQUEMENT : le token (MAPBOX_TOKEN, sans
 * scopes secrets) ne part jamais dans un bundle client, c'est ce qui protège
 * le quota (100 000 requêtes gratuites/mois, vérifié 2026-08).
 *
 * Politique de panne : AUCUN repli de distance. La zone est un engagement
 * (« blocage net hors zone ») ; estimer au vol d'oiseau pourrait accepter une
 * course hors zone ou refuser une course valide. Mapbox indisponible →
 * MapboxUnavailableError, que les routes traduisent en 503 « réessayez ».
 */

export class MapboxUnavailableError extends Error {
  constructor(cause?: string) {
    super(`Mapbox Directions indisponible${cause ? ` (${cause})` : ''}`);
    this.name = 'MapboxUnavailableError';
  }
}

export interface DrivingRoute {
  /** Distance routière, km arrondis à 0,1. */
  distanceKm: number;
  /** Durée de conduite estimée HORS trafic, minutes entières. */
  durationMin: number;
}

function mapboxToken(): string {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) throw new MapboxUnavailableError('MAPBOX_TOKEN manquant');
  return token;
}

export async function getDrivingRoute(
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): Promise<DrivingRoute> {
  // ⚠️ Mapbox attend lon,lat — l'inverse de l'ordre usuel.
  const coords = `${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?overview=false&alternatives=false&access_token=${mapboxToken()}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  } catch (e) {
    throw new MapboxUnavailableError(e instanceof Error ? e.message : 'réseau');
  }
  if (!response.ok) {
    throw new MapboxUnavailableError(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    code?: string;
    routes?: Array<{ distance: number; duration: number }>;
  };
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) {
    // NoRoute/NoSegment : pas d'itinéraire routier (île, point isolé…).
    // Traité comme indisponible : on ne devine pas une distance.
    throw new MapboxUnavailableError(data.code ?? 'réponse vide');
  }

  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMin: Math.round(route.duration / 60),
  };
}
