/**
 * useNewFeatures Hook
 *
 * Surfaces a small "Nouveau" indicator next to menu items the user
 * hasn't tapped yet, so providers who update the app discover the
 * features we ship without us having to push a tutorial.
 *
 * State is persisted in AsyncStorage as a Set of feature keys that
 * have been "seen" (key tapped at least once OR explicitly
 * dismissed). The list of currently-new features is hardcoded
 * below — when we ship a new one, add it here. Old keys stay in
 * NEW_FEATURE_KEYS until everyone has had a reasonable chance to
 * see them, then we trim them out.
 *
 * Storage key versioned so a future schema change doesn't break
 * older clients silently.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Add a key here when shipping a feature you want a blue dot on.
 * Remove it ~3-4 weeks after release once most users have seen it.
 *
 * Keys are arbitrary strings — they're never shown to the user.
 */
export const NEW_FEATURE_KEYS = [
  'stats-2026-05',
  'payments-2026-05',
] as const;

export type NewFeatureKey = (typeof NEW_FEATURE_KEYS)[number];

const STORAGE_KEY = '@opatam/new-features-seen-v1';

interface State {
  seen: Set<string>;
  ready: boolean;
}

export function useNewFeatures() {
  const [state, setState] = useState<State>({
    seen: new Set<string>(),
    ready: false,
  });

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        const arr: string[] = raw ? JSON.parse(raw) : [];
        setState({ seen: new Set(arr), ready: true });
      } catch (err) {
        console.warn('[useNewFeatures] hydrate failed:', err);
        if (!cancelled) {
          setState({ seen: new Set(), ready: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** True when the feature has NOT been seen yet (and we know that for sure). */
  const isNew = useCallback(
    (key: NewFeatureKey): boolean => {
      if (!state.ready) return false; // don't flash "Nouveau" before hydration
      return !state.seen.has(key);
    },
    [state],
  );

  /** Mark the feature as seen — persist + flip local state. */
  const markSeen = useCallback(
    async (key: NewFeatureKey) => {
      // No-op if already seen — saves a write.
      if (state.seen.has(key)) return;
      const next = new Set(state.seen);
      next.add(key);
      setState((s) => ({ ...s, seen: next }));
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch (err) {
        console.warn('[useNewFeatures] persist failed:', err);
      }
    },
    [state.seen],
  );

  return { isNew, markSeen, ready: state.ready };
}
