/**
 * Devis de déplacement — le cœur serveur du chantier.
 *
 * `computeTravelQuote` : origine privée du lieu → adresse cliente résolue →
 * distance routière (Mapbox) → palier. Pré-filtre haversine CERTAIN : le vol
 * d'oiseau minore toujours la route, donc s'il dépasse déjà la limite de
 * zone, on refuse sans appel API.
 *
 * Devis signé (HMAC, courte durée) : le tunnel obtient un devis via
 * /api/travel/quote, et le renvoie à la création — le serveur vérifie la
 * signature au lieu de rappeler Mapbox. Le jeton lie locationId + placeId :
 * impossible de deviser près du pro puis de réserver ailleurs.
 *
 * Cache mémoire : mitigation du double appel devis→création quand les deux
 * tombent sur la même instance. Jamais une garantie (multi-instances Vercel) ;
 * un cache miss coûte un appel Mapbox, gratuit à notre échelle.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  haversineDistance,
  resolveTravelTier,
  roundCoordinate,
  travelZoneLimitKm,
  type TravelZoneTier,
} from '@booking-app/shared';
import { getDrivingRoute, type DrivingRoute } from './mapbox';

export interface TravelQuoteResult {
  inZone: boolean;
  /** Renseignés quand inZone. */
  fee: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  /** Limite de la zone (km) — toujours renseignée. */
  maxKm: number;
}

// ── Cache mémoire ────────────────────────────────────────────────────────────

const routeCache = new Map<string, { route: DrivingRoute; expiresAt: number }>();
const ROUTE_CACHE_TTL_MS = 60 * 60 * 1000;
const ROUTE_CACHE_MAX = 500;

async function getDrivingRouteCached(
  cacheKey: string,
  origin: { latitude: number; longitude: number },
  dest: { latitude: number; longitude: number },
): Promise<DrivingRoute> {
  const hit = routeCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.route;

  const route = await getDrivingRoute(origin, dest);
  if (routeCache.size >= ROUTE_CACHE_MAX) {
    const oldest = routeCache.keys().next().value;
    if (oldest !== undefined) routeCache.delete(oldest);
  }
  routeCache.set(cacheKey, { route, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
  return route;
}

// ── Devis ────────────────────────────────────────────────────────────────────

/** Throw MapboxUnavailableError si la distance ne peut pas être établie. */
export async function computeTravelQuote(
  locationId: string,
  origin: { latitude: number; longitude: number },
  tiers: TravelZoneTier[],
  clientGeo: { latitude: number; longitude: number },
): Promise<TravelQuoteResult> {
  const maxKm = travelZoneLimitKm(tiers);
  if (maxKm === null) {
    // Zone non configurée : l'appelant n'aurait pas dû arriver ici.
    return { inZone: false, fee: null, distanceKm: null, durationMin: null, maxKm: 0 };
  }

  // Pré-filtre certain : haversine ≤ distance routière.
  const birdKm = haversineDistance(
    origin.latitude,
    origin.longitude,
    clientGeo.latitude,
    clientGeo.longitude,
  );
  if (birdKm > maxKm) {
    return { inZone: false, fee: null, distanceKm: null, durationMin: null, maxKm };
  }

  const cacheKey = `${locationId}:${roundCoordinate(clientGeo.latitude, 4)}:${roundCoordinate(clientGeo.longitude, 4)}`;
  const route = await getDrivingRouteCached(cacheKey, origin, clientGeo);

  const tier = resolveTravelTier(tiers, route.distanceKm);
  if (!tier) {
    return { inZone: false, fee: null, distanceKm: route.distanceKm, durationMin: route.durationMin, maxKm };
  }
  return {
    inZone: true,
    fee: tier.fee,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    maxKm,
  };
}

// ── Devis signé ──────────────────────────────────────────────────────────────

const QUOTE_VERSION = 'tq1';
const QUOTE_TTL_SECONDS = 15 * 60;

export interface TravelQuotePayload {
  locationId: string;
  placeId: string;
  fee: number;
  distanceKm: number;
  durationMin: number | null;
  /** Ville résolue côté serveur au moment du devis (snapshot public). */
  clientCity: string;
  exp: number; // epoch secondes
}

function quoteSecret(): string {
  const s = process.env.TRAVEL_QUOTE_SECRET;
  if (!s) throw new Error('TRAVEL_QUOTE_SECRET manquant');
  return s;
}

const b64u = (buf: Buffer) => buf.toString('base64url');

export function signTravelQuote(payload: Omit<TravelQuotePayload, 'exp'>): string {
  const full: TravelQuotePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + QUOTE_TTL_SECONDS,
  };
  const body = b64u(Buffer.from(JSON.stringify(full), 'utf8'));
  const mac = createHmac('sha256', quoteSecret()).update(`${QUOTE_VERSION}.${body}`).digest();
  return `${QUOTE_VERSION}.${body}.${b64u(mac)}`;
}

/**
 * Vérifie un devis signé et son rattachement au couple lieu/adresse.
 * null = invalide/expiré/mal lié → l'appelant recalcule.
 */
export function verifyTravelQuote(
  token: string,
  expected: { locationId: string; placeId: string },
): TravelQuotePayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== QUOTE_VERSION) return null;
  const [, body, mac] = parts;

  let expectedMac: Buffer;
  let givenMac: Buffer;
  try {
    expectedMac = createHmac('sha256', quoteSecret()).update(`${QUOTE_VERSION}.${body}`).digest();
    givenMac = Buffer.from(mac, 'base64url');
  } catch {
    return null;
  }
  if (givenMac.length !== expectedMac.length || !timingSafeEqual(givenMac, expectedMac)) {
    return null;
  }

  let payload: TravelQuotePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (payload.locationId !== expected.locationId || payload.placeId !== expected.placeId) {
    return null;
  }
  return payload;
}
