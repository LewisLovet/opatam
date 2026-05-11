/**
 * useTrackingPermission
 *
 * iOS App Tracking Transparency (ATT) — manages the system prompt
 * that gates access to the IDFA. Without an explicit grant the
 * Meta SDK falls back to SKAdNetwork, which is far less precise
 * for attribution; iOS users who decline are effectively invisible
 * to ad optimisation.
 *
 * Strategy:
 *   - Skip while the user is in the (auth) flow — asking right
 *     during onboarding is intrusive AND has worse acceptance
 *     than asking once the user has seen value.
 *   - Defer to the first "main app" screen (e.g. (pro)/(tabs)/...).
 *   - Once handled (grant or deny), Apple won't show the prompt
 *     again — we record the decision via `getTrackingPermissionsAsync`
 *     and skip the call on next launch.
 *   - On grant: enable `Settings.setAdvertiserTrackingEnabled(true)`
 *     on the FB SDK so subsequent events ship the IDFA.
 *   - On deny: explicitly disable advertiser tracking so the SDK
 *     doesn't try to read a redacted IDFA — events still log via
 *     SKAdNetwork attribution.
 *
 * Android: ATT does not exist — `requestTrackingPermissionsAsync`
 * resolves with `granted` immediately and the SDK is enabled.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSegments } from 'expo-router';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { useAuth } from '../contexts';
import { setAdvertiserTracking } from '../lib/metaSdk';

export function useTrackingPermission() {
  const { user } = useAuth();
  const segments = useSegments();
  const inAuthFlow = segments[0] === '(auth)';
  // Guard against double-prompt within the same session. Apple
  // wouldn't re-show the system dialog anyway, but a redundant
  // call would still trip a re-render and a SDK call.
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    // Auth not strictly required for ATT (you can ask any time on
    // iOS), but pairing it with auth means we ask AFTER the user
    // has invested in the product — better acceptance rate.
    if (!user?.uid) return;
    if (inAuthFlow) return;

    (async () => {
      try {
        // On Android this resolves `granted` immediately.
        const current = await TrackingTransparency.getTrackingPermissionsAsync();
        if (current.status === 'undetermined') {
          const result = await TrackingTransparency.requestTrackingPermissionsAsync();
          setAdvertiserTracking(result.status === 'granted');
        } else {
          // Already decided in a previous session — sync the SDK
          // flag to the user's prior choice so events fire with the
          // correct attribution mode.
          setAdvertiserTracking(current.status === 'granted');
        }
      } catch (err) {
        // Best-effort: never block the app on an ATT failure.
        // Likely cause: running on a simulator without the ATT
        // framework, or expo-tracking-transparency not linked
        // (would need an eas build).
        console.warn('[useTrackingPermission] ATT prompt failed:', err);
      } finally {
        handledRef.current = true;
      }
    })();
  }, [user?.uid, inAuthFlow]);
}

/** Reset hook for tests / dev — clears the in-memory guard so the
 *  effect can be re-evaluated. Not exported from the index. */
export function __resetTrackingPermissionGuard() {
  // No-op: the guard lives in a closure ref per hook instance, so
  // re-mounting the consumer is enough to re-trigger. Provided for
  // API symmetry with future expansion.
}

/** Convenience platform check — useful for screens that want to
 *  show messaging only on iOS where ATT is relevant. */
export const IS_ATT_RELEVANT = Platform.OS === 'ios';
