/**
 * LocationInitializer
 *
 * Renders the LocationPermissionPrompt at the root of the app.
 * Mirrors NotificationInitializer — single instance mounted in the
 * top-level _layout, no per-screen prompts.
 */

import { useSegments } from 'expo-router';
import { useLocationPermissionPrompt } from '../hooks/useLocationPermissionPrompt';
import { LocationPermissionPrompt } from './LocationPermissionPrompt';
import { useAuth } from '../contexts/AuthContext';

export function LocationInitializer() {
  const { user } = useAuth();
  // First segment is the route group — `(auth)` while still signing in.
  const segments = useSegments();
  const inAuthFlow = segments[0] === '(auth)';
  // Only prime location once the user is logged in and out of the auth
  // flow — never at cold app start.
  const enabled = !!user?.uid && !inAuthFlow;

  const {
    showPermissionPrompt,
    acceptLocation,
    declineLocation,
  } = useLocationPermissionPrompt(enabled);

  return (
    <LocationPermissionPrompt
      visible={showPermissionPrompt}
      onAccept={acceptLocation}
      onDecline={declineLocation}
    />
  );
}
