'use client';

/**
 * MetaPixel — lazy script loader for the Facebook/Meta pixel.
 *
 * Behaviour:
 *  - Renders absolutely nothing until the visitor consents.
 *  - On `'granted'`, injects Meta's `fbevents.js` snippet ONCE
 *    (idempotent across re-renders) and fires the initial
 *    `PageView`. Subsequent `PageView`s on client-side navigation
 *    are wired below via `usePathname` / `useSearchParams`.
 *  - On `'denied'` (post-acceptance revocation), calls
 *    `fbq('consent', 'revoke')` so any already-loaded script
 *    stops sending events. The script itself stays in memory —
 *    Meta doesn't expose a clean way to unload it — but it goes
 *    silent.
 *  - No-op when `NEXT_PUBLIC_META_PIXEL_ID` is missing (e.g. local
 *    dev where the env var isn't set). Keeps preview deploys
 *    clean.
 *
 * Why not Next's <Script> component: we need to fire `init` +
 * `track` synchronously after the script loads, AND we need to
 * gate the whole thing on consent state which lives in React
 * state. Manual `<script>` injection inside a useEffect is the
 * simplest way to get both, even if it looks more verbose.
 */
import { useContext, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from '@/hooks/useConsent';
import { AuthContext } from '@/contexts/AuthContext';
import { META_PIXEL_ID, setPixelConsent } from '@/lib/meta-pixel';

/** Marker set on the script tag so we don't re-inject on remounts. */
const SCRIPT_DOM_ID = 'meta-pixel-snippet';

/**
 * Advanced Matching payload — plaintext user data we hand to `fbq('init')`.
 *
 * Meta normalises (trim + lowercase) and SHA-256 hashes these values
 * **client-side** before sending. We never expose raw PII over the
 * wire ourselves. Property names match Meta's catalog exactly: `em`
 * (email), `external_id` (stable user id), `ph` (phone, E.164), `fn`
 * (first name), `ln` (last name). See
 * https://developers.facebook.com/docs/meta-pixel/advanced/advanced-matching
 */
interface AdvancedMatchingPayload {
  em?: string;
  external_id?: string;
  ph?: string;
  fn?: string;
  ln?: string;
}

/** Init the Pixel for the given user (or anonymously when no
 *  userData). Safe to call multiple times — Meta uses the latest
 *  init payload for subsequent track() calls. */
function fbqInit(pixelId: string, userData?: AdvancedMatchingPayload): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.fbq) return;
  if (userData && Object.keys(userData).length > 0) {
    w.fbq('init', pixelId, userData);
  } else {
    w.fbq('init', pixelId);
  }
}

/** Inject Meta's official Pixel snippet. Idempotent — early-exits
 *  if the script is already on the page. */
function injectPixelScript(pixelId: string, userData?: AdvancedMatchingPayload): void {
  if (document.getElementById(SCRIPT_DOM_ID)) return;

  // Initialise the fbq queue exactly the way Meta's snippet does,
  // so any `fbq(...)` calls made BEFORE the async script loads
  // still get replayed. The snippet here is a faithful port of
  // the one Meta hands you in Events Manager.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.fbq) return; // already initialised by something else
  const fbq: any = function () {
    // eslint-disable-next-line prefer-rest-params
    fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
  };
  if (!w._fbq) w._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  w.fbq = fbq;

  const script = document.createElement('script');
  script.id = SCRIPT_DOM_ID;
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  // Init + first PageView. The init must run before any track()
  // calls; we queue them above just in case the script hasn't
  // arrived yet — fbq replays the queue on load. When the visitor
  // is already authenticated at first paint, Advanced Matching
  // ships with the very first PageView.
  fbqInit(pixelId, userData);
  w.fbq('track', 'PageView');
}

export function MetaPixel() {
  const { status } = useConsent();
  // Read AuthContext directly (instead of `useAuth()`) so we degrade
  // gracefully if MetaPixel happens to render outside the provider
  // tree — analytics must never break the page. When `auth` is
  // undefined we just emit anonymous events; Advanced Matching kicks
  // in as soon as the provider is available.
  const auth = useContext(AuthContext);
  const firebaseUser = auth?.firebaseUser ?? null;
  const user = auth?.user ?? null;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Track whether we've fired the initial PageView so we don't
  // double-fire on the first paint (the script's own `track`
  // already covers that one).
  const initialPvFiredRef = useRef(false);
  // Remember the last UID we re-init'd with so we don't burn
  // cycles re-initing on every render. `null` = anonymous.
  const lastUidRef = useRef<string | null | undefined>(undefined);

  // Build the Advanced Matching payload from the current auth state.
  // `firebaseUser` carries the email/uid; `user` is the Firestore
  // profile we can use for richer matching (name, phone) when
  // available. We split `displayName` on the first whitespace into
  // first/last — imperfect for compound names but Meta is tolerant
  // (it normalises both before hashing).
  const advancedMatching: AdvancedMatchingPayload | undefined = (() => {
    if (!firebaseUser) return undefined;
    const out: AdvancedMatchingPayload = {
      em: firebaseUser.email ?? undefined,
      external_id: firebaseUser.uid,
    };
    const displayName = user?.displayName?.trim();
    if (displayName) {
      const parts = displayName.split(/\s+/);
      out.fn = parts[0];
      if (parts.length > 1) out.ln = parts.slice(1).join(' ');
    }
    if (user?.phone) {
      // E.164 without the leading `+` — Meta's convention.
      const digits = user.phone.replace(/\D/g, '');
      if (digits.length >= 8) out.ph = digits;
    }
    return out;
  })();

  // 1. Script injection + consent state sync + Advanced Matching
  //    re-init on auth changes. Re-running on `firebaseUser?.uid`
  //    catches login/logout: when the visitor signs in mid-session
  //    we call `fbq('init', ...)` again with their identity so
  //    every subsequent event ships hashed Advanced Matching data.
  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (status === 'denied') {
      setPixelConsent(false);
      return;
    }
    if (status !== 'granted') return;

    if (!document.getElementById(SCRIPT_DOM_ID)) {
      injectPixelScript(META_PIXEL_ID, advancedMatching);
      initialPvFiredRef.current = true;
    } else if (firebaseUser?.uid !== lastUidRef.current) {
      // Script already injected; identity changed (login/logout/
      // account switch). Re-init so subsequent events carry the
      // up-to-date Advanced Matching block.
      fbqInit(META_PIXEL_ID, advancedMatching);
    }
    lastUidRef.current = firebaseUser?.uid ?? null;
    setPixelConsent(true);
  }, [status, firebaseUser?.uid, advancedMatching]);

  // 2. PageView on every client-side route change. App Router
  //    doesn't fire a global navigation event, so we observe
  //    pathname / search params and ping the Pixel ourselves.
  //    Skipped when consent isn't granted (the helper itself
  //    no-ops too, but checking here avoids dead work).
  useEffect(() => {
    if (status !== 'granted') return;
    // Skip the very first run — the initial injection above
    // already sent the first PageView for this load.
    if (!initialPvFiredRef.current) {
      initialPvFiredRef.current = true;
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).fbq?.('track', 'PageView');
  }, [pathname, searchParams, status]);

  // 3. <noscript> pixel fallback for browsers with JS disabled.
  //    Renders only after consent is granted, to honour RGPD even
  //    for that 0.05% of visitors. The img is a 1×1 tracker that
  //    bypasses the JS snippet entirely.
  if (!META_PIXEL_ID || status !== 'granted') return null;
  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        height="1"
        width="1"
        style={{ display: 'none' }}
        alt=""
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
      />
    </noscript>
  );
}
