/**
 * Meta SDK (Facebook) — thin wrapper around `react-native-fbsdk-next`.
 *
 * Mirrors the web `lib/meta-pixel.ts` API surface so call sites can
 * share patterns: `trackEvent('Lead')`, `trackEvent('CompleteRegistration')`,
 * etc. Underneath it's a different transport (the Facebook SDK
 * native module) but the call site doesn't need to know.
 *
 * Initialization is handled by the `react-native-fbsdk-next` Expo
 * config plugin in app.json (`isAutoInitEnabled: true`), so by the
 * time JS runs the SDK is already up. We just call `logEvent` /
 * `setUserData` / `setUserID` as needed.
 *
 * iOS App Tracking Transparency: Apple requires explicit user
 * consent before the SDK can read the IDFA. The SDK respects the
 * system-level decision automatically — when ATT is denied, events
 * still go through but stripped of advertising identifiers (Meta
 * falls back to its SKAdNetwork attribution model in that case).
 * Triggering the ATT prompt itself is left to the caller — see
 * `requestTrackingPermission()` below — because the right moment
 * to ask is product-dependent (don't blast the prompt at cold
 * launch — show it after the first meaningful screen).
 *
 * Safety: every helper is wrapped in a try/catch so a misconfigured
 * SDK never crashes the app. Failures are logged via `console.warn`
 * and that's the end of it — analytics is best-effort.
 */

import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

/** Mirror of the web `MetaStandardEvent` union — same names so the
 *  two surfaces look like one API at the call site. Each maps to
 *  the corresponding Meta "Standard Event" on the dashboard. */
export type MetaStandardEvent =
  | 'Lead'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'Subscribe'
  | 'Purchase'
  | 'ViewContent'
  | 'StartTrial';

/**
 * Maps our typed event names to the SDK constants the native
 * libraries expect. The SDK exposes these as
 * `AppEventsLogger.AppEvents.*` but importing all of them at the
 * top causes RN bridge warnings on cold start; we use string
 * literals (which the SDK accepts equivalently) and centralise the
 * mapping here.
 */
const STANDARD_EVENT_NAME: Record<MetaStandardEvent, string> = {
  Lead: 'fb_mobile_lead',
  CompleteRegistration: 'fb_mobile_complete_registration',
  InitiateCheckout: 'fb_mobile_initiated_checkout',
  Subscribe: 'Subscribe',
  Purchase: 'fb_mobile_purchase',
  ViewContent: 'fb_mobile_content_view',
  StartTrial: 'StartTrial',
};

export interface MetaEventParams {
  /** Monetary value (positive number, e.g. 19.99). */
  value?: number;
  /** ISO-4217 currency code, required when `value` is set. */
  currency?: string;
  /** Free-form name of what the event is about. */
  contentName?: string;
  /** Category for the event ("subscription", "tutorial"…). */
  contentCategory?: string;
  /** Stable identifier(s) for the content (provider slug, plan id…). */
  contentIds?: string[];
}

/**
 * Fire a Meta standard event from the mobile app.
 *
 * Best-effort: a failure here is logged and swallowed so analytics
 * never blocks the user flow.
 */
export function trackEvent(
  name: MetaStandardEvent,
  params?: MetaEventParams,
): void {
  try {
    const eventName = STANDARD_EVENT_NAME[name];
    const value = params?.value;
    const parameters: Record<string, string | number> = {};
    if (params?.currency) parameters.fb_currency = params.currency;
    if (params?.contentName) parameters.fb_content_name = params.contentName;
    if (params?.contentCategory) parameters.fb_content_type = params.contentCategory;
    if (params?.contentIds) parameters.fb_content_id = params.contentIds.join(',');

    if (typeof value === 'number') {
      // The 3-arg signature is the one Meta uses for monetary
      // events (Purchase / Subscribe / etc.) — currency + value
      // give the dashboard a per-event amount.
      AppEventsLogger.logEvent(eventName, value, parameters);
    } else {
      AppEventsLogger.logEvent(eventName, parameters);
    }
  } catch (err) {
    console.warn('[metaSdk] trackEvent failed:', err);
  }
}

/** Custom event outside Meta's standard catalog. Use sparingly —
 *  standard events benefit from Meta's pre-built conversion
 *  optimisation models. */
export function trackCustomEvent(
  name: string,
  params?: Record<string, string | number>,
): void {
  try {
    if (params) {
      AppEventsLogger.logEvent(name, params);
    } else {
      AppEventsLogger.logEvent(name);
    }
  } catch (err) {
    console.warn('[metaSdk] trackCustomEvent failed:', err);
  }
}

/**
 * Attach a stable user identifier to subsequent events. Meta uses
 * this to deduplicate identities across devices and to enable
 * Advanced Matching. Pass `null` to clear (logout).
 *
 * We pass the Firebase UID — same identifier the rest of the
 * backend uses, hashed by Meta on receipt so we don't leak raw
 * IDs.
 */
export function setUserId(uid: string | null): void {
  try {
    if (uid) {
      AppEventsLogger.setUserID(uid);
    } else {
      AppEventsLogger.clearUserID();
    }
  } catch (err) {
    console.warn('[metaSdk] setUserId failed:', err);
  }
}

/**
 * Toggle the Meta SDK's tracking mode. Should be called once the
 * user has either accepted ATT (iOS) or explicit in-app consent
 * (Android). When set to false the SDK still logs events but
 * strips the IDFA / Google Advertising ID — limited attribution
 * via SKAdNetwork on iOS.
 *
 * Default = follow Apple's ATT decision automatically. Only call
 * this if you need to override (e.g. additional in-app cookie
 * banner on Android).
 */
export function setAdvertiserTracking(enabled: boolean): void {
  try {
    Settings.setAdvertiserTrackingEnabled(enabled);
  } catch (err) {
    console.warn('[metaSdk] setAdvertiserTracking failed:', err);
  }
}

/**
 * Plaintext PII to attach to subsequent app events for Meta's
 * "Advanced Matching" — the SDK normalises (trim + lowercase) and
 * SHA-256 hashes these values **on-device** before sending, so no
 * raw value leaves the app. Mirrors the web Pixel's `fbq('init',
 * pixelId, { em, external_id, ... })` shape.
 *
 * Property keys match the FB SDK's `UserDataKey` constants:
 *   em → email, ph → phone (digits only), fn / ln → first / last
 *   name, ge → gender, ct → city, st → state, zip → postal code,
 *   country → ISO-3166 alpha-2.
 */
export interface MetaUserData {
  em?: string | null;
  ph?: string | null;
  fn?: string | null;
  ln?: string | null;
  ge?: 'm' | 'f' | null;
  ct?: string | null;
  st?: string | null;
  zip?: string | null;
  country?: string | null;
}

/**
 * Push Advanced Matching user data to the SDK. Every subsequent
 * `trackEvent` call ships these hashes alongside the event, so
 * Meta can attribute conversions back to a Facebook account even
 * when the IDFA is unavailable (ATT denied) — match quality
 * typically goes from ~4/10 to ~7-8/10.
 *
 * Call this on login + whenever the user's profile changes (email
 * update, etc.). Pass an empty object to clear on logout.
 *
 * Note: `setUserData` and `setUserID` are complementary — the
 * former enriches matching, the latter pins a stable identifier.
 * Use both for best results.
 */
export function setUserData(data: MetaUserData): void {
  try {
    // The SDK expects all-string values and drops null/undefined.
    // We normalise here so call sites can pass nullish fields
    // without scrubbing.
    const payload: Record<string, string> = {};
    if (data.em) payload.em = data.em;
    if (data.ph) payload.ph = data.ph;
    if (data.fn) payload.fn = data.fn;
    if (data.ln) payload.ln = data.ln;
    if (data.ge) payload.ge = data.ge;
    if (data.ct) payload.ct = data.ct;
    if (data.st) payload.st = data.st;
    if (data.zip) payload.zip = data.zip;
    if (data.country) payload.country = data.country;
    // The SDK uses different method names across SDK versions; the
    // generic call below works since v13. Casting to any keeps us
    // forwards-compatible without committing to a specific shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logger = AppEventsLogger as any;
    if (typeof logger.setUserData === 'function') {
      logger.setUserData(payload);
    } else if (typeof logger.updateUserProperties === 'function') {
      logger.updateUserProperties(payload);
    }
  } catch (err) {
    console.warn('[metaSdk] setUserData failed:', err);
  }
}
