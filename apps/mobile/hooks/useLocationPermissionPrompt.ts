/**
 * useLocationPermissionPrompt Hook
 *
 * Drives the priming flow for foreground location permission.
 * Designed to be consumed exclusively by `LocationInitializer`
 * (mounted once at the root layout) — *not* by individual screens.
 * Screens that need the location data use `useUserLocation` which
 * just reads the current grant state without ever triggering the
 * native dialog.
 *
 * Lifecycle:
 *   1. On mount, check the current foreground permission status.
 *   2. If 'undetermined' → set showPermissionPrompt to true so the
 *      modal appears.
 *   3. User taps "Activer" → call requestForegroundPermissionsAsync
 *      (the native dialog), then ping every useUserLocation
 *      consumer to re-fetch.
 *   4. User taps "Plus tard" → just close the modal; the system
 *      stays at 'undetermined' so we *can* ask again later from
 *      somewhere actionable (e.g. a "Activer la localisation"
 *      button on the search screen).
 *
 * Avoid showing the priming on app open if the user has already
 * answered (granted or denied) — both states leave nothing for
 * the priming to do.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { notifyLocationPermissionChanged } from './useUserLocation';

export interface UseLocationPermissionPromptResult {
  showPermissionPrompt: boolean;
  acceptLocation: () => Promise<void>;
  declineLocation: () => void;
}

export function useLocationPermissionPrompt(
  enabled: boolean = true,
): UseLocationPermissionPromptResult {
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  useEffect(() => {
    // Only prime once the caller allows it (e.g. user logged in) — never
    // at cold app start before the user has even signed in.
    if (!enabled) {
      setShowPermissionPrompt(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status === 'undetermined') {
          setShowPermissionPrompt(true);
        }
      } catch (err) {
        console.warn('[useLocationPermissionPrompt] status check failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const acceptLocation = useCallback(async () => {
    setShowPermissionPrompt(false);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch (err) {
      console.warn('[useLocationPermissionPrompt] request failed:', err);
    }
    // Whether granted or not, fire the change event so all the
    // useUserLocation consumers re-evaluate their state.
    notifyLocationPermissionChanged();
  }, []);

  const declineLocation = useCallback(() => {
    setShowPermissionPrompt(false);
    // No native call → status stays 'undetermined'. The user can
    // still tap a "Activer" button later from search/home.
  }, []);

  return {
    showPermissionPrompt,
    acceptLocation,
    declineLocation,
  };
}
