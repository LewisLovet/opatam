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
 *
 * Implementation note: the seen-set lives at module scope rather
 * than inside `useState`. Without that, every screen calling
 * `useNewFeatures()` got its OWN isolated copy — so tapping a
 * MenuItem in `more.tsx` updated AsyncStorage but the discovery
 * dot driven by a SEPARATE hook instance in `(tabs)/_layout.tsx`
 * kept showing the badge until the next app launch (re-hydration).
 * The fix: a shared module-level state + a tiny pub/sub so every
 * mounted hook re-renders on every change.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Add a key here when shipping a feature you want a blue dot on.
 *
 * Convention: each entry has a `[retire-après: YYYY-MM-DD]` comment
 * giving a soft expiry date — usually ~3-4 weeks after release. Run
 * `git grep "retire-après"` to find keys due for cleanup. When a key
 * is removed here it stays harmless on old clients (the hook just
 * ignores stale entries in AsyncStorage), so removing is safe.
 *
 * Keys are arbitrary strings — they're never shown to the user.
 */
export const NEW_FEATURE_KEYS = [
  'stats-2026-05',         // [retire-après: 2026-07-01]
  'payments-2026-05',      // [retire-après: 2026-07-01]
  'clients-2026-05',       // [retire-après: 2026-07-08]
  'story-share-2026-05',   // [retire-après: 2026-07-15]
  'auto-review-2026-05',   // [retire-après: 2026-07-15]
] as const;

export type NewFeatureKey = (typeof NEW_FEATURE_KEYS)[number];

/**
 * Subset of NEW_FEATURE_KEYS that live behind the bottom-tab "Plus".
 * Used by the tabs layout to decide whether to render a discovery
 * dot on that tab — if any of these is still unseen, the dot shows.
 */
export const MORE_TAB_FEATURE_KEYS: NewFeatureKey[] = [
  'stats-2026-05',
  'payments-2026-05',
  'clients-2026-05',
  // Auto-review toggle lives inside booking-settings, which is
  // itself accessed from the Plus tab — so the discovery dot on
  // the Plus tab should fire for this key too.
  'auto-review-2026-05',
];

const STORAGE_KEY = '@opatam/new-features-seen-v1';

// ─── Module-level shared state ──────────────────────────────────────
//
// One Set, one ready flag, one set of subscribers. Every hook
// instance reads from these and is notified of changes via the
// `subscribers` callbacks, so taking action in one screen
// instantly updates badges everywhere else.

let globalSeen: Set<string> = new Set();
let globalReady = false;
let hydratePromise: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function notifyAll() {
  subscribers.forEach((cb) => cb());
}

/** Hydrate from AsyncStorage exactly once, ever. Subsequent calls
 *  return the same promise so callers can `await` it without racing. */
function ensureHydrated(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      globalSeen = new Set(arr);
    } catch (err) {
      console.warn('[useNewFeatures] hydrate failed:', err);
    } finally {
      globalReady = true;
      notifyAll();
    }
  })();
  return hydratePromise;
}

export function useNewFeatures() {
  // We don't track values in state — they live in module scope.
  // This counter just forces a re-render when something changes.
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    ensureHydrated();
    const onChange = () => forceUpdate((v) => v + 1);
    subscribers.add(onChange);
    return () => {
      subscribers.delete(onChange);
    };
  }, []);

  /** True when the feature has NOT been seen yet (and we know that for sure). */
  const isNew = useCallback((key: NewFeatureKey): boolean => {
    if (!globalReady) return false; // don't flash "Nouveau" before hydration
    return !globalSeen.has(key);
  }, []);

  /** Mark the feature as seen — persist + flip local state across all hook instances. */
  const markSeen = useCallback(async (key: NewFeatureKey) => {
    if (globalSeen.has(key)) return; // no-op if already seen
    globalSeen = new Set(globalSeen);
    globalSeen.add(key);
    notifyAll(); // re-render every mounted hook instance immediately
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...globalSeen]),
      );
    } catch (err) {
      console.warn('[useNewFeatures] persist failed:', err);
    }
  }, []);

  /** True when at least one of the given keys is still unseen.
   *  Use to drive a single discovery dot on the bottom-tab "Plus"
   *  icon — we don't need to know which feature is new, just that
   *  the user should explore the More menu. */
  const hasAnyUnseen = useCallback(
    (keys: readonly NewFeatureKey[]): boolean => {
      if (!globalReady) return false;
      return keys.some((k) => !globalSeen.has(k));
    },
    [],
  );

  return { isNew, hasAnyUnseen, markSeen, ready: globalReady };
}
