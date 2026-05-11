/**
 * Meta Pixel — type-safe wrapper around the `fbq()` global.
 *
 * The Pixel script is loaded lazily by <MetaPixel> only when the
 * visitor has granted consent (see useConsent / ConsentBanner).
 * Helpers in this file are safe to call even before the script
 * loads — they queue or no-op without throwing, so call sites
 * don't have to care about timing.
 *
 * RGPD: every helper checks consent before firing. A call to
 * `trackEvent('Lead')` made when consent is `'denied'` is a no-op
 * — no data leaves the browser. This way components can fire
 * events confidently without a guard at every call site.
 */

/** Pixel ID — public, can ship in the client bundle. */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';

/**
 * Meta's standard event catalog — typed for safety so a typo in an
 * event name is caught at compile time. Add to this union as you
 * wire new conversions.
 *
 * See https://developers.facebook.com/docs/meta-pixel/reference for
 * the full list and the data shapes each event expects.
 */
export type MetaStandardEvent =
  | 'PageView'
  | 'Lead'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'Subscribe'
  | 'Purchase'
  | 'ViewContent'
  | 'Contact'
  | 'StartTrial';

/** Optional event params Meta uses for richer attribution. */
export interface MetaEventParams {
  /** Monetary value (positive number, e.g. 19.99). */
  value?: number;
  /** ISO-4217 currency code, e.g. 'EUR'. Required when `value` is set. */
  currency?: string;
  /** Free-form name of what the event is about ("Pro plan", etc.). */
  content_name?: string;
  /** Category for the event ("subscription", "tutorial"…). */
  content_category?: string;
  /** Stable identifier for the content (provider slug, plan id…). */
  content_ids?: string[];
  /** Predicted lifetime value for advanced bidding. */
  predicted_ltv?: number;
}

/**
 * The fbq global injected by Meta's Pixel snippet. Declared loosely
 * here so the helpers compile without `@types/facebook-pixel` (which
 * doesn't exist as a maintained package).
 */
declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      // The Pixel snippet wires an internal queue; we don't need to
      // touch it directly but it's here for completeness.
      queue?: unknown[];
    };
  }
}

/** Fire a Pixel event by name. No-op if the script isn't loaded
 *  yet (= visitor hasn't consented), so call sites are guard-free. */
export function trackEvent(
  name: MetaStandardEvent,
  params?: MetaEventParams,
): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) return;
  if (params) {
    window.fbq('track', name, params);
  } else {
    window.fbq('track', name);
  }
}

/** Same shape, but for events outside Meta's standard catalog.
 *  Use sparingly — standard events benefit from Meta's pre-built
 *  conversion optimisation models, custom ones don't. */
export function trackCustomEvent(
  name: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) return;
  if (params) {
    window.fbq('trackCustom', name, params);
  } else {
    window.fbq('trackCustom', name);
  }
}

/**
 * Inform Meta of a consent state change. Called by the consent
 * banner when the user clicks Accept / Decline AFTER the script
 * already loaded (e.g. they accept, then later revoke). On first
 * load we just don't inject the script at all until consent is
 * granted — see <MetaPixel>.
 *
 * Meta's `consent` API gates ALL subsequent `track` calls on the
 * Pixel side, so revoking consent here also kills automatic
 * PageViews fired on route changes.
 */
export function setPixelConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) return;
  window.fbq('consent', granted ? 'grant' : 'revoke');
}
