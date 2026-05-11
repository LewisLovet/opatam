'use client';

/**
 * useConsent — RGPD cookie-consent state machine.
 *
 * Tracks a single binary decision (accepted / refused) persisted
 * in localStorage. The state is also broadcast across tabs via
 * the `storage` event so a decision made in one tab updates the
 * Pixel script in every other open tab immediately.
 *
 * Three values for `status`:
 *   - 'unknown' → first visit, banner shows, nothing fires
 *   - 'granted' → Pixel + future analytics load
 *   - 'denied'  → Pixel + analytics never load, banner hides
 *
 * Storage key is versioned (`v1`) so we can re-prompt the user
 * after a policy change without nuking localStorage by hand.
 *
 * Bumping the version is the documented way to ask everyone again
 * — required by the CNIL when the scope of tracked data changes
 * (e.g. adding a new third party).
 */
import { useCallback, useEffect, useState } from 'react';

/** Allowed values stored under STORAGE_KEY. */
type StoredConsent = 'granted' | 'denied';

/** What `useConsent()` returns. The 'unknown' state means the
 *  visitor hasn't seen the banner yet (or hydrated from storage). */
export type ConsentStatus = 'unknown' | StoredConsent;

const STORAGE_KEY = '@opatam/consent-v1';
/** Same-tab notifications (the native `storage` event only fires
 *  across tabs, not in the tab that wrote it). */
const SAME_TAB_EVENT = 'opatam:consent-changed';

function readStored(): ConsentStatus {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'granted' || raw === 'denied') return raw;
    return 'unknown';
  } catch {
    // localStorage may throw in Safari private mode etc.
    return 'unknown';
  }
}

export function useConsent() {
  // Start with 'unknown' on the server-render path; hydrate from
  // localStorage on the client to avoid a hydration mismatch.
  const [status, setStatus] = useState<ConsentStatus>('unknown');

  useEffect(() => {
    setStatus(readStored());

    const onChange = () => setStatus(readStored());
    window.addEventListener('storage', onChange);
    window.addEventListener(SAME_TAB_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener(SAME_TAB_EVENT, onChange as EventListener);
    };
  }, []);

  const setConsent = useCallback((next: StoredConsent) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Same Safari private-mode caveat. Silently swallow; the
      // banner will reappear on next visit and that's fine.
    }
    setStatus(next);
    // Broadcast to other components in the same tab. The native
    // `storage` event only fires in OTHER tabs.
    window.dispatchEvent(new Event(SAME_TAB_EVENT));
  }, []);

  return { status, setConsent };
}
