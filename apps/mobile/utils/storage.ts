/**
 * Storage Utils
 * AsyncStorage helpers for app state persistence
 *
 * IMPORTANT: every key MUST be prefixed `@opatam/` so the dev-mode
 * "Purger" actions can scope their wipe to our own keys without
 * touching anything else (react-navigation state, third-party libs,
 * etc.).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ONBOARDING_SEEN: '@opatam/onboarding_seen',
  NEW_FEATURES_SEEN: '@opatam/new-features-seen-v1',
} as const;

const OPATAM_PREFIX = '@opatam/';

/**
 * Check if user has seen the onboarding
 */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_SEEN);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as seen
 */
export async function setOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.ONBOARDING_SEEN, 'true');
  } catch (error) {
    console.error('Error saving onboarding state:', error);
  }
}

/**
 * Reset onboarding state (for testing)
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.ONBOARDING_SEEN);
  } catch (error) {
    console.error('Error resetting onboarding state:', error);
  }
}

/**
 * Reset the "Nouveau" pill / discovery banner state — every
 * unseen feature key flips back to "unseen" so the pro can
 * re-experience the discovery flow on the next app launch.
 *
 * Wired into the DevFAB menu — never called from prod UI.
 */
export async function resetNewFeaturesSeen(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.NEW_FEATURES_SEEN);
  } catch (error) {
    console.error('Error resetting new-features state:', error);
  }
}

/**
 * Wipe ALL `@opatam/*` keys from AsyncStorage in one shot.
 * Convenient "fresh install" simulation for testing — onboarding,
 * discovery flags, anything we own — without touching libraries'
 * own AsyncStorage entries (e.g. react-navigation history).
 */
export async function resetAllOpatamStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(OPATAM_PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch (error) {
    console.error('Error wiping @opatam/* storage:', error);
  }
}
