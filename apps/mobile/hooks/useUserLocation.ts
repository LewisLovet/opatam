/**
 * useUserLocation Hook
 * Requests location permission and returns the user's current position
 * Uses expo-location (included in Expo Go)
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

export function useUserLocation(): UseUserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mountedRef = useRef(true);

  const fetchLocation = useCallback(async () => {
    setLoading(true);

    try {
      // Check / request permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (mountedRef.current) {
          setPermissionDenied(true);
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

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    location,
    loading,
    permissionDenied,
    refresh: fetchLocation,
  };
}
