/**
 * TrackingInitializer
 *
 * Mounts the ATT permission hook at app root. Renders nothing —
 * the system iOS dialog is presented by `requestTrackingPermissionsAsync`
 * directly. See `useTrackingPermission` for the timing strategy
 * (skips the auth flow, fires on first main-app screen).
 */
import { useTrackingPermission } from '../hooks/useTrackingPermission';

export function TrackingInitializer() {
  useTrackingPermission();
  return null;
}
