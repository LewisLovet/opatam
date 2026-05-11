/**
 * MetaAuthSync
 *
 * Syncs the Firebase auth state into the Meta SDK so every
 * `AppEventsLogger.logEvent(...)` call ships hashed Advanced
 * Matching data alongside the event (email / UID / name / phone).
 * Mirrors the web Pixel's `fbq('init', pixelId, userData)` flow.
 *
 * The SDK normalises (trim + lowercase) and SHA-256 hashes
 * everything on-device — raw PII never leaves the phone.
 *
 * Renders nothing — purely side-effectful. Mount once near the
 * root, inside AuthProvider, alongside NotificationInitializer.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts';
import { setUserData, setUserId } from '../lib/metaSdk';

export function MetaAuthSync() {
  const { user, userData } = useAuth();
  // Track the last UID we synced so we don't burn SDK calls on
  // every render — only when identity actually changes.
  const lastUidRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const uid = user?.uid ?? null;
    if (uid === lastUidRef.current) return;
    lastUidRef.current = uid;

    if (!uid) {
      // Logout — clear identity from the SDK so subsequent events
      // are anonymous again.
      setUserId(null);
      setUserData({});
      return;
    }

    setUserId(uid);
    // Build Advanced Matching from whatever profile data we have.
    // `displayName` is split on the first whitespace into first /
    // last — imperfect for compound names, but Meta normalises
    // (trim + lowercase) before hashing so it's tolerant.
    const displayName = userData?.displayName?.trim();
    let fn: string | undefined;
    let ln: string | undefined;
    if (displayName) {
      const parts = displayName.split(/\s+/);
      fn = parts[0];
      if (parts.length > 1) ln = parts.slice(1).join(' ');
    }
    // E.164 without the leading `+` — Meta's convention.
    const phoneDigits = userData?.phone ? userData.phone.replace(/\D/g, '') : undefined;
    setUserData({
      em: user?.email ?? null,
      ph: phoneDigits && phoneDigits.length >= 8 ? phoneDigits : null,
      fn,
      ln,
      ge:
        userData?.gender === 'male'
          ? 'm'
          : userData?.gender === 'female'
            ? 'f'
            : null,
      ct: userData?.city ?? null,
    });
  }, [user, userData]);

  return null;
}
