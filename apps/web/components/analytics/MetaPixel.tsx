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
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from '@/hooks/useConsent';
import { META_PIXEL_ID, setPixelConsent } from '@/lib/meta-pixel';

/** Marker set on the script tag so we don't re-inject on remounts. */
const SCRIPT_DOM_ID = 'meta-pixel-snippet';

/** Inject Meta's official Pixel snippet. Idempotent — early-exits
 *  if the script is already on the page. */
function injectPixelScript(pixelId: string): void {
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
  // arrived yet — fbq replays the queue on load.
  w.fbq('init', pixelId);
  w.fbq('track', 'PageView');
}

export function MetaPixel() {
  const { status } = useConsent();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Track whether we've fired the initial PageView so we don't
  // double-fire on the first paint (the script's own `track`
  // already covers that one).
  const initialPvFiredRef = useRef(false);

  // 1. Script injection / consent state sync.
  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (status === 'granted') {
      injectPixelScript(META_PIXEL_ID);
      setPixelConsent(true);
      initialPvFiredRef.current = true;
    } else if (status === 'denied') {
      setPixelConsent(false);
    }
  }, [status]);

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
