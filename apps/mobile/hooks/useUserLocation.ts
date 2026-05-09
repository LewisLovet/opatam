/**
 * useUserLocation Hook
 *
 * Returns the user's current position when the foreground permission
 * is already granted. **Does not trigger the native iOS/Android
 * permission dialog** — that's the job of `LocationInitializer`,
 * which shows a friendly priming modal first (see
 * `LocationPermissionPrompt`). The screens that consume this hook
 * just read whatever the current grant state allows.
 *
 * Coordination: when the priming flow grants permission for the
 * first time, the initializer calls `notifyLocationPermissionGranted`
 * which forces every mounted instance of this hook to re-fetch.
 * Without it, screens that mounted before the prompt was answered
 * would stay stuck on `loading: false, location: null`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

export interface UseUserLocationResult {
  location: UserLocation | null;
  loading: boolean;
  permissionDenied: boolean;
  refresh: () => Promise<void>;
}

// Module-level subscriber set used by LocationInitializer to ping
// every mounted hook instance after a permission flip. Cheaper and
// simpler than a Context since location is consumed across multiple
// route trees (home + search) and adding a Provider for one piece
// of state would over-engineer this.
type Listener = () => void;
const listeners = new Set<Listener>();

/** Called by LocationInitializer right after the user has answered
 *  the priming flow (whether they granted or not). Forces every
 *  consumer of useUserLocation to re-evaluate the current permission
 *  status and fetch the position if newly granted. */
export function notifyLocationPermissionChanged(): void {
  listeners.forEach((fn) => fn());
}

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mountedRef = useRef(true);

  const fetchLocation = useCallback(async () => {
    setLoading(true);

    try {
      // Read-only check — does NOT show the native permission
      // dialog. The dialog is only shown by LocationInitializer
      // after the user has accepted the priming modal.
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status === 'denied') {
        if (mountedRef.current) {
          setPermissionDenied(true);
          setLoading(false);
        }
        return;
      }

      if (status !== 'granted') {
        // 'undetermined' — the user hasn't been asked yet. Bail
        // out silently; LocationInitializer will surface the
        // priming modal and re-trigger this hook on accept.
        if (mountedRef.current) {
          setLoading(false);
        }
        return;
      }

      // Get current position (low accuracy is faster and sufficient for city-level)
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get city name
      let city: string | null = null;
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode) {
          city = geocode.city || geocode.subregion || null;
        }
      } catch {
        // Reverse geocode can fail silently — we still have coords
      }

      if (mountedRef.current) {
        setLocation({ latitude, longitude, city });
        setPermissionDenied(false);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchLocation();

    // Subscribe so we re-fetch when the priming flow flips the
    // permission to granted (or denied).
    listeners.add(fetchLocation);

    return () => {
      mountedRef.current = false;
      listeners.delete(fetchLocation);
    };
  }, [fetchLocation]);

  return {
    location,
    loading,
    permissionDenied,
    refresh: fetchLocation,
  };
}
