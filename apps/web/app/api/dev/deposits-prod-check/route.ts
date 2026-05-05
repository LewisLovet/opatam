/**
 * GET /api/dev/deposits-prod-check
 *
 * Read-only end-to-end smoke test for the deposits launch checklist.
 * Hits Stripe in both LIVE and TEST modes (when configured) and
 * reports each piece needed for the feature to actually work in prod:
 *
 *   - Sérénité add-on product exists with metadata.addon = "deposits"
 *   - Webhook endpoint is registered + listens to the right events
 *   - Connect events stream is wired (separate webhook OR connect-flag
 *     on the platform endpoint)
 *
 * Pure read — no Stripe writes, no Firestore writes. Safe to spam.
 *
 * Returns:
 *   {
 *     live: { addon: …, platformWebhook: …, connectWebhook: … },
 *     test: { … }   // omitted if STRIPE_SECRET_KEY_DEV not set
 *   }
 */

import { NextResponse } from 'next/server';
import { getStripe, getStripeDev, getAddonPriceId } from '@/lib/stripe';
import type Stripe from 'stripe';

interface CheckResult {
  ok: boolean;
  detail: string;
  data?: unknown;
}

interface ModeReport {
  mode: 'live' | 'test';
  addon: CheckResult;
  platformWebhook: CheckResult;
  connectWebhook: CheckResult;
}

const REQUIRED_PLATFORM_EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'account.updated',
  'account.application.deauthorized',
];

const REQUIRED_CONNECT_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'charge.refunded',
  'charge.dispute.created',
  'payment_intent.payment_failed',
];

async function checkAddon(stripe: Stripe): Promise<CheckResult> {
  try {
    const priceId = await getAddonPriceId('deposits', stripe);
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    });
    const product = price.product as Stripe.Product;
    const amount = price.unit_amount ?? 0;
    const currency = price.currency.toUpperCase();
    const interval = price.recurring?.interval ?? 'one-time';
    return {
      ok: true,
      detail: `Trouvé : ${product.name} → ${(amount / 100).toFixed(2)} ${currency} / ${interval}`,
      data: {
        productId: product.id,
        priceId: price.id,
        productName: product.name,
        amount,
        currency,
        interval,
        metadata: product.metadata,
      },
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Stripe has two generations of webhook endpoints:
 *
 *  1. **V1 (legacy)** — `stripe.webhookEndpoints.*` API. The endpoint
 *     object has a `connect: boolean` flag that tells you whether it
 *     listens to platform events or events from connected accounts.
 *
 *  2. **V2 (current)** — `stripe.v2.core.eventDestinations.*` API.
 *     Same idea but the Connect distinction is in `events_from`:
 *     `'self'` for platform events, `'other_accounts'` for Connect
 *     events.
 *
 * The Stripe Dashboard now creates Connect endpoints exclusively via
 * V2, so we have to merge both lists to give the user a true picture.
 * The webhook handler itself accepts events from either generation —
 * Stripe signs them the same way and our `getWebhookSecrets()` tries
 * each configured signing secret.
 */
async function checkWebhooks(
  stripe: Stripe,
): Promise<{ platform: CheckResult; connect: CheckResult }> {
  // ─── V1 endpoints ─────────────────────────────────────────────────
  const v1Endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  type V1WithConnect = Stripe.WebhookEndpoint & { connect?: boolean };

  const v1Platform = v1Endpoints.data.filter(
    (e) => !(e as V1WithConnect).connect,
  );
  const v1Connect = v1Endpoints.data.filter(
    (e) => (e as V1WithConnect).connect === true,
  );

  // ─── V2 event destinations ────────────────────────────────────────
  // Older SDK versions don't expose the v2 namespace yet — we tolerate
  // that and fall back to V1-only.
  let v2Platform: Array<{ id: string; name: string; status: string; enabled_events: string[] }> = [];
  let v2Connect: typeof v2Platform = [];
  try {
    const v2 = (stripe as unknown as {
      v2?: { core?: { eventDestinations?: { list: (params: { limit: number }) => AsyncIterable<unknown> & { data?: unknown[] } } } };
    }).v2?.core?.eventDestinations;
    if (v2) {
      const page = await (v2.list({ limit: 100 }) as unknown as Promise<{
        data: Array<{
          id: string;
          name: string;
          status: 'enabled' | 'disabled';
          enabled_events: string[];
          events_from?: Array<'self' | 'other_accounts'>;
        }>;
      }>);
      for (const dest of page.data ?? []) {
        if (dest.status !== 'enabled') continue;
        const isConnect = dest.events_from?.includes('other_accounts') ?? false;
        const isPlatform = dest.events_from?.includes('self') ?? !isConnect;
        const slim = {
          id: dest.id,
          name: dest.name,
          status: dest.status,
          enabled_events: dest.enabled_events,
        };
        if (isConnect) v2Connect.push(slim);
        if (isPlatform) v2Platform.push(slim);
      }
    }
  } catch {
    // SDK without v2 support — leave the v2 lists empty.
  }

  // ─── Merge both generations ───────────────────────────────────────
  const platformEvents = new Set([
    ...v1Platform.flatMap((e) => e.enabled_events),
    ...v2Platform.flatMap((e) => e.enabled_events),
  ]);
  const connectEvents = new Set([
    ...v1Connect.flatMap((e) => e.enabled_events),
    ...v2Connect.flatMap((e) => e.enabled_events),
  ]);
  const platformWildcard =
    v1Platform.some((e) => e.enabled_events.includes('*')) ||
    v2Platform.some((e) => e.enabled_events.includes('*'));
  const connectWildcard =
    v1Connect.some((e) => e.enabled_events.includes('*')) ||
    v2Connect.some((e) => e.enabled_events.includes('*'));

  const missingPlatform = platformWildcard
    ? []
    : REQUIRED_PLATFORM_EVENTS.filter((evt) => !platformEvents.has(evt));
  const missingConnect = connectWildcard
    ? []
    : REQUIRED_CONNECT_EVENTS.filter((evt) => !connectEvents.has(evt));

  const platformCount = v1Platform.length + v2Platform.length;
  const connectCount = v1Connect.length + v2Connect.length;

  const summariseV1 = (eps: Stripe.WebhookEndpoint[]) =>
    eps.map((e) => ({
      generation: 'v1' as const,
      id: e.id,
      url: e.url,
      status: e.status,
      enabled_events: e.enabled_events,
    }));

  const summariseV2 = (eps: typeof v2Platform) =>
    eps.map((e) => ({
      generation: 'v2' as const,
      id: e.id,
      name: e.name,
      status: e.status,
      enabled_events: e.enabled_events,
    }));

  return {
    platform: {
      ok: platformCount > 0 && missingPlatform.length === 0,
      detail:
        platformCount === 0
          ? 'Aucun endpoint plateforme configuré'
          : missingPlatform.length === 0
            ? `${platformCount} endpoint(s) plateforme actif(s) — tous les events requis sont écoutés`
            : `Manque sur le webhook plateforme : ${missingPlatform.join(', ')}`,
      data: {
        endpoints: [...summariseV1(v1Platform), ...summariseV2(v2Platform)],
        missingEvents: missingPlatform,
      },
    },
    connect: {
      ok: connectCount > 0 && missingConnect.length === 0,
      detail:
        connectCount === 0
          ? 'Aucun endpoint Connect configuré (créez-en un et choisissez "Comptes connectés" comme source)'
          : missingConnect.length === 0
            ? `${connectCount} endpoint(s) Connect actif(s) — tous les events requis sont écoutés`
            : `Manque sur le webhook Connect : ${missingConnect.join(', ')}`,
      data: {
        endpoints: [...summariseV1(v1Connect), ...summariseV2(v2Connect)],
        missingEvents: missingConnect,
      },
    },
  };
}

async function reportMode(
  stripe: Stripe,
  mode: 'live' | 'test',
): Promise<ModeReport> {
  const [addon, webhooks] = await Promise.all([
    checkAddon(stripe),
    checkWebhooks(stripe),
  ]);
  return {
    mode,
    addon,
    platformWebhook: webhooks.platform,
    connectWebhook: webhooks.connect,
  };
}

export async function GET() {
  try {
    const reports: { live?: ModeReport; test?: ModeReport } = {};

    // LIVE check is the critical one — that's what's running in prod.
    try {
      reports.live = await reportMode(getStripe(), 'live');
    } catch (err) {
      reports.live = {
        mode: 'live',
        addon: {
          ok: false,
          detail: `Stripe LIVE indisponible : ${err instanceof Error ? err.message : err}`,
        },
        platformWebhook: { ok: false, detail: 'non testé' },
        connectWebhook: { ok: false, detail: 'non testé' },
      };
    }

    // TEST check is bonus — only when the dev key is set.
    if (process.env.STRIPE_SECRET_KEY_DEV) {
      try {
        reports.test = await reportMode(getStripeDev(), 'test');
      } catch (err) {
        reports.test = {
          mode: 'test',
          addon: {
            ok: false,
            detail: `Stripe TEST indisponible : ${err instanceof Error ? err.message : err}`,
          },
          platformWebhook: { ok: false, detail: 'non testé' },
          connectWebhook: { ok: false, detail: 'non testé' },
        };
      }
    }

    return NextResponse.json({
      requiredPlatformEvents: REQUIRED_PLATFORM_EVENTS,
      requiredConnectEvents: REQUIRED_CONNECT_EVENTS,
      ...reports,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
