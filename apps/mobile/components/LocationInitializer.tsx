/**
 * LocationInitializer
 *
 * Renders the LocationPermissionPrompt at the root of the app.
 * Mirrors NotificationInitializer — single instance mounted in the
 * top-level _layout, no per-screen prompts.
 */

import { useLocationPermissionPrompt } from '../hooks/useLocationPermissionPrompt';
import { LocationPermissionPrompt } from './LocationPermissionPrompt';

export function LocationInitializer() {
  const {
    showPermissionPrompt,
    acceptLocation,
    declineLocation,
  } = useLocationPermissionPrompt();

  return (
    <LocationPermissionPrompt
      visible={showPermissionPrompt}
      onAccept={acceptLocation}
      onDecline={declineLocation}
    />
  );
}
