/**
 * Meta Conversions API (CAPI) — server-side event sender.
 *
 * Why this exists: the browser-side Pixel is blocked by ad blockers
 * on ~25% of visits, and iOS post-ATT signal loss further degrades
 * client-side attribution. The CAPI sends conversion events
 * server-to-server, directly from our infra to Meta — no blocker
 * can intercept it, and the data is reliable (we know money changed
 * hands from Stripe / RevenueCat).
 *
 * Pairing with the client Pixel: Meta deduplicates when the same
 * `event_id` is observed via both transports. The client Pixel
 * provides browser context (IP, UA, fbp/fbc cookie → match
 * quality); the server provides the reliable conversion fact. Use
 * the same `event_id` on both sides for the same logical event.
 *
 * No-op when `META_PIXEL_ID` or `META_CAPI_ACCESS_TOKEN` is missing
 * (e.g. preview deploys, local dev): we just log and skip. Analytics
 * never blocks the business flow.
 */
import { createHash } from 'crypto';

const GRAPH_API_VERSION = 'v21.0';

const PIXEL_ID = process.env.META_PIXEL_ID ?? '';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN ?? '';
/** Optional — when set, Meta routes these events to the Test Events
 *  tab instead of production stats. Useful to validate the
 *  integration end-to-end. Found in Events Manager → Test events. */
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE ?? '';

/** Standard events we currently use. Extend as new conversions are
 *  wired. Names match Meta's catalog so the Events Manager dashboard
 *  picks them up automatically. */
export type CapiStandardEvent =
  | 'Lead'
  | 'CompleteRegistration'
  | 'StartTrial'
  | 'Subscribe'
  | 'Purchase'
  | 'InitiateCheckout'
  | 'ViewContent';

/** Where the event originated — Meta uses this for attribution
 *  modelling. `'website'` for desktop/mobile browser, `'app'` for
 *  in-app purchases through Apple/Google IAP. */
export type CapiActionSource = 'website' | 'app' | 'system_generated' | 'other';

/** Personally identifiable user data. Everything in here is hashed
 *  (SHA-256, normalised) before leaving our server — Meta receives
 *  only the digest, never the raw value. */
export interface CapiUserData {
  /** Lowercased + trimmed email. */
  email?: string | null;
  /** E.164 phone WITHOUT the `+` (Meta convention). */
  phone?: string | null;
  /** Firebase UID — used as Meta's `external_id` for cross-device
   *  matching. Hashed like the rest. */
  externalId?: string | null;
  /** First name (lowercase, no accents). */
  firstName?: string | null;
  /** Last name (lowercase, no accents). */
  lastName?: string | null;
  /** Country (ISO-3166 alpha-2, lowercase). */
  country?: string | null;
  /** City (lowercase, no spaces). */
  city?: string | null;
  /** `_fbp` cookie value, e.g. "fb.1.1596403881668.1116446470". */
  fbp?: string | null;
  /** `_fbc` cookie value or constructed from fbclid query param. */
  fbc?: string | null;
  /** End-user IP (only available when we proxy the action, not in
   *  webhook context). */
  clientIpAddress?: string | null;
  /** End-user user-agent string. */
  clientUserAgent?: string | null;
}

/** Custom event data. Standard event names have well-known expected
 *  fields (value/currency for monetary events, content_* for catalog
 *  events) — see https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/custom-data */
export interface CapiCustomData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: 'product' | 'product_group';
  /** Optional subscription ID for Subscribe/StartTrial events. */
  subscriptionId?: string;
  /** Optional order ID for Purchase events. */
  orderId?: string;
  /** Number of items — defaults to 1 for subscriptions. */
  numItems?: number;
}

export interface CapiEvent {
  eventName: CapiStandardEvent;
  /** Unique identifier for dedup with the client Pixel. Pass the
   *  SAME id on both sides for the same conversion. We default-build
   *  one from `${eventName}-${entityId}` when omitted. */
  eventId?: string;
  /** Unix seconds. Defaults to "now" — pass an earlier value when
   *  re-firing historical events (Meta accepts up to 7 days old). */
  eventTime?: number;
  /** URL where the conversion happened (web). Optional for app. */
  eventSourceUrl?: string;
  actionSource: CapiActionSource;
  userData: CapiUserData;
  customData?: CapiCustomData;
}

/** SHA-256 of a normalised string, hex-encoded. Returns `undefined`
 *  for empty / null values so we can omit the field entirely from
 *  the payload (Meta rejects empty hashed strings). */
function hashField(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  return createHash('sha256').update(normalised).digest('hex');
}

/** Build the `user_data` block in Meta's expected shape. Hashed
 *  fields are wrapped in arrays — Meta accepts multiple values per
 *  field (e.g. multiple emails per user). */
function buildUserData(input: CapiUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const em = hashField(input.email);
  const ph = hashField(input.phone);
  const ext = hashField(input.externalId);
  const fn = hashField(input.firstName);
  const ln = hashField(input.lastName);
  const ct = hashField(input.city);
  const co = hashField(input.country);

  if (em) out.em = [em];
  if (ph) out.ph = [ph];
  if (ext) out.external_id = [ext];
  if (fn) out.fn = [fn];
  if (ln) out.ln = [ln];
  if (ct) out.ct = [ct];
  if (co) out.country = [co];
  // fbp/fbc/ip/UA are passed VERBATIM (not hashed). Meta uses them
  // for client-side correlation.
  if (input.fbp) out.fbp = input.fbp;
  if (input.fbc) out.fbc = input.fbc;
  if (input.clientIpAddress) out.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) out.client_user_agent = input.clientUserAgent;

  return out;
}

/** Build the `custom_data` block. Field names follow Meta's snake_case
 *  convention. We drop undefined fields silently so call sites don't
 *  need to spread carefully. */
function buildCustomData(input: CapiCustomData | undefined): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const out: Record<string, unknown> = {};
  if (typeof input.value === 'number') out.value = input.value;
  if (input.currency) out.currency = input.currency.toUpperCase();
  if (input.contentName) out.content_name = input.contentName;
  if (input.contentCategory) out.content_category = input.contentCategory;
  if (input.contentIds?.length) out.content_ids = input.contentIds;
  if (input.contentType) out.content_type = input.contentType;
  if (input.subscriptionId) out.subscription_id = input.subscriptionId;
  if (input.orderId) out.order_id = input.orderId;
  if (typeof input.numItems === 'number') out.num_items = input.numItems;
  return Object.keys(out).length ? out : undefined;
}

/**
 * Fire a single event to Meta's Conversions API.
 *
 * Returns `{ ok: true }` on success or `{ ok: false, reason }` on
 * failure. **Never throws** — analytics is best-effort, and the
 * caller doesn't need a try/catch. If you want to log the failure,
 * inspect the return value.
 *
 * No-op (returns `{ ok: false, reason: 'not-configured' }`) when
 * the env vars aren't set. Useful for preview deploys.
 */
export async function sendCapiEvent(
  event: CapiEvent,
): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return { ok: false, reason: 'not-configured' };
  }

  const eventId = event.eventId ?? `${event.eventName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const eventTime = event.eventTime ?? Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: event.actionSource,
        ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
        user_data: buildUserData(event.userData),
        ...(buildCustomData(event.customData) ? { custom_data: buildCustomData(event.customData) } : {}),
      },
    ],
  };
  if (TEST_EVENT_CODE) {
    payload.test_event_code = TEST_EVENT_CODE;
  }

  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<unreadable>');
      console.warn(`[META-CAPI] ${event.eventName} failed: HTTP ${res.status} — ${text}`);
      return { ok: false, reason: `http-${res.status}` };
    }
    console.log(`[META-CAPI] ${event.eventName} sent (event_id=${eventId})`);
    return { ok: true, eventId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[META-CAPI] ${event.eventName} threw: ${msg}`);
    return { ok: false, reason: `error:${msg}` };
  }
}

/**
 * Build a deterministic `event_id` for a subscription event. Using
 * the Stripe subscription id (or RC original_transaction_id) means
 * even if the webhook retries, Meta sees the same id and dedupes.
 */
export function subscriptionEventId(eventName: CapiStandardEvent, subscriptionId: string): string {
  return `${eventName}:${subscriptionId}`;
}
