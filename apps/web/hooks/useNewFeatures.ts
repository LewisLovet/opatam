'use client';

/**
 * useNewFeatures (web)
 *
 * Web counterpart to apps/mobile/hooks/useNewFeatures — same
 * concept (a small "Nouveau" indicator on menu items the pro
 * hasn't tapped yet), persisted in `localStorage` instead of
 * AsyncStorage.
 *
 * Keys + display labels are kept in sync with the mobile
 * version so a single feature shipped on both platforms uses
 * one identifier across the codebase.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Add a key here when shipping a feature you want a "Nouveau" pill on.
 *
 * Convention: each entry has a `[retire-après: YYYY-MM-DD]` comment
 * giving a soft expiry date — usually ~3-4 weeks after release. Run
 * `git grep "retire-après"` to find keys due for cleanup. Once a
 * key is removed from this array, the hook ignores any leftover
 * entries in localStorage so removal is always safe.
 */
export const NEW_FEATURE_KEYS = [
  'stats-2026-05',       // [retire-après: 2026-07-01]
  'payments-2026-05',    // [retire-après: 2026-07-01]
  'clients-2026-05',     // [retire-après: 2026-07-08]
  'auto-review-2026-05', // [retire-après: 2026-07-15]
  'tutoriels-2026-05',   // [retire-après: 2026-07-15]
] as const;

export type NewFeatureKey = (typeof NEW_FEATURE_KEYS)[number];

/** User-facing labels used by the discovery banner. */
export const FEATURE_DISPLAY_LABELS: Record<NewFeatureKey, string> = {
  'stats-2026-05': 'Statistiques',
  'payments-2026-05': 'Paiements',
  'clients-2026-05': 'Clients',
  'auto-review-2026-05': 'Relance automatique des avis',
  'tutoriels-2026-05': 'Tutoriels & guides',
};

const STORAGE_KEY = '@opatam/web-new-features-seen-v1';

interface State {
  seen: Set<string>;
  ready: boolean;
}

function read(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function write(next: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function useNewFeatures() {
  const [state, setState] = useState<State>({
    seen: new Set<string>(),
    ready: false,
  });

  // Hydrate on mount — `ready` flips true once we know the real
  // value, so we don't flash a "Nouveau" badge for a key that's
  // actually been seen.
  useEffect(() => {
    setState({ seen: read(), ready: true });
  }, []);

  /** True when the feature has NOT been seen yet AND we know that
   *  for sure (post-hydration). */
  const isNew = useCallback(
    (key: NewFeatureKey): boolean => {
      if (!state.ready) return false;
      return !state.seen.has(key);
    },
    [state],
  );

  /** True when at least one of the given keys is still unseen. */
  const hasAnyUnseen = useCallback(
    (keys: readonly NewFeatureKey[]): boolean => {
      if (!state.ready) return false;
      return keys.some((k) => !state.seen.has(k));
    },
    [state],
  );

  const markSeen = useCallback(
    (key: NewFeatureKey) => {
      setState((s) => {
        if (s.seen.has(key)) return s;
        const next = new Set(s.seen);
        next.add(key);
        write(next);
        return { ...s, seen: next };
      });
    },
    [],
  );

  /** Mark every given key as seen — used by the discovery banner's
   *  dismiss button so closing it makes the badges go away too. */
  const markAllSeen = useCallback(
    (keys: readonly NewFeatureKey[]) => {
      setState((s) => {
        const next = new Set(s.seen);
        let changed = false;
        for (const k of keys) {
          if (!next.has(k)) {
            next.add(k);
            changed = true;
          }
        }
        if (!changed) return s;
        write(next);
        return { ...s, seen: next };
      });
    },
    [],
  );

  return {
    isNew,
    hasAnyUnseen,
    markSeen,
    markAllSeen,
    ready: state.ready,
  };
}
