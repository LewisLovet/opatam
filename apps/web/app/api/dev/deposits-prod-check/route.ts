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

async function checkWebhooks(
  stripe: Stripe,
): Promise<{ platform: CheckResult; connect: CheckResult }> {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

  // Platform endpoint = api_version specified, application=null,
  // listens to platform-level events (no Connect-specific events
  // unless connect:true is set).
  const platformEndpoints = endpoints.data.filter(
    (e) => e.application === null,
  );

  // A "Connect endpoint" can be either:
  //  - A dedicated endpoint with the Connect flag (in API: not exposed
  //    directly, but inferable via the `connect` param being true on
  //    creation — Stripe doesn't return it)
  //  - The platform endpoint also listening on Connect events (set
  //    "Listen to events on connected accounts" in the Dashboard)
  // We can't tell directly, so we report what events are listened
  // to and leave it to the human to verify the Connect flag.
  // Heuristic: if any endpoint listens to Connect-only events
  // (charge.refunded on Connect doesn't differ from platform but
  // checkout.session.expired with bookingId metadata does), assume OK.
  const connectCandidates = platformEndpoints.filter((e) =>
    e.enabled_events.some((evt) => REQUIRED_CONNECT_EVENTS.includes(evt)),
  );

  // Find which platform events are missing across ALL endpoints
  const allListenedEvents = new Set(
    platformEndpoints.flatMap((e) => e.enabled_events),
  );
  const wildcardListening = platformEndpoints.some((e) =>
    e.enabled_events.includes('*'),
  );

  const missingPlatform = wildcardListening
    ? []
    : REQUIRED_PLATFORM_EVENTS.filter((evt) => !allListenedEvents.has(evt));
  const missingConnect = wildcardListening
    ? []
    : REQUIRED_CONNECT_EVENTS.filter((evt) => !allListenedEvents.has(evt));

  return {
    platform: {
      ok: missingPlatform.length === 0,
      detail:
        missingPlatform.length === 0
          ? `${platformEndpoints.length} endpoint(s) actif(s) — tous les events plateforme requis sont écoutés`
          : `Manque sur le webhook plateforme : ${missingPlatform.join(', ')}`,
      data: {
        endpoints: platformEndpoints.map((e) => ({
          id: e.id,
          url: e.url,
          status: e.status,
          enabled_events: e.enabled_events,
        })),
        missingEvents: missingPlatform,
      },
    },
    connect: {
      ok: missingConnect.length === 0 && connectCandidates.length > 0,
      detail:
        missingConnect.length === 0 && connectCandidates.length > 0
          ? `${connectCandidates.length} endpoint(s) écoutant les events Connect — vérifiez manuellement le flag "Listen to events on connected accounts"`
          : missingConnect.length > 0
            ? `Manque pour les events Connect : ${missingConnect.join(', ')}`
            : `Aucun endpoint ne semble écouter les events Connect requis`,
      data: {
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
