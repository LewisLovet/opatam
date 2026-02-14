/**
 * useNearbyProviders Hook
 * Fetches providers near the user's location, sorted by distance
 * Falls back to top-rated providers if location is unavailable
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { providerService } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import type { UserLocation } from './useUserLocation';

export interface NearbyProvider extends WithId<Provider> {
  distance: number;
}

export interface UseNearbyProvidersResult {
  providers: NearbyProvider[];
  loading: boolean;
  isNearby: boolean; // true if sorted by proximity, false if fallback to top-rated
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNearbyProviders(
  userLocation: UserLocation | null,
  locationLoading: boolean,
  limit: number = 5
): UseNearbyProvidersResult {
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNearby, setIsNearby] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    // Wait for location to finish loading
    if (locationLoading) return;

    setLoading(true);
    setError(null);

    try {
      if (userLocation) {
        // We have location — fetch nearby
        const result = await providerService.getNearby(
          userLocation.latitude,
          userLocation.longitude,
          userLocation.city,
          limit
        );
        if (mountedRef.current) {
          setProviders(result);
          setIsNearby(true);
        }
      } else {
        // No location — fallback to top rated
        const result = await providerService.getTopRated(limit);
        if (mountedRef.current) {
          setProviders(result.map((p) => ({ ...p, distance: Infinity })));
          setIsNearby(false);
        }
      }
    } catch (err) {
      console.error('Error loading nearby providers:', err);
      if (mountedRef.current) {
        setError('Erreur lors du chargement des suggestions');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userLocation, locationLoading, limit]);

  useEffect(() => {
    mountedRef.current = true;
    load();

    return () => {
      mountedRef.current = false;
    };
  }, [userLocation, locationLoading]); // Re-run when location becomes available

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    providers,
    loading: loading || locationLoading,
    isNearby,
    error,
    refresh,
  };
}
