/**
 * Storage Utils
 * AsyncStorage helpers for app state persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ONBOARDING_SEEN: '@opatam/onboarding_seen',
} as const;

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
