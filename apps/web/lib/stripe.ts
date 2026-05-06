import Stripe from 'stripe';

// Lazy singleton instance of Stripe client (initialized on first use, not at build time)
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    stripeInstance = new Stripe(key, { apiVersion: '2025-04-30.basil' as Stripe.LatestApiVersion });
  }
  return stripeInstance;
}

/**
 * Get the Stripe client for affiliate/dev operations.
 * Uses STRIPE_SECRET_KEY_DEV (sk_test_...) if available, otherwise falls back to STRIPE_SECRET_KEY.
 * This allows testing the affiliate flow in Stripe test mode without affecting production checkout.
 */
let stripeDevInstance: Stripe | null = null;

export function getStripeDev(): Stripe {
  if (!stripeDevInstance) {
    const key = process.env.STRIPE_SECRET_KEY_DEV || process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    stripeDevInstance = new Stripe(key);
  }
  return stripeDevInstance;
}

/**
 * Add-on price ID lookup. Resolves the Stripe Price for an add-on
 * (e.g. 'deposits', 'sms') by listing active prices and matching on
 * `product.metadata.addon`. The product must exist in Stripe with
 * `metadata.addon = "<addon-name>"` set — that's how we distinguish
 * each paid add-on from regular subscription products.
 *
 * The result is cached in memory for 10 minutes so the same Stripe
 * instance is hit at most once per env per cache window — but cache
 * invalidation is automatic on cold start (Vercel function reload).
 *
 * Why dynamic instead of env vars: same pattern as the subscription
 * plans (see /api/stripe/prices) — the Stripe Dashboard is the single
 * source of truth for prices. Adding a new add-on is "create the
 * product in Stripe with metadata.addon = '...'" — no env var, no
 * deploy, no risk of dev/prod divergence.
 *
 * Two-mode (test vs live) support: each Stripe instance maintains its
 * own cache so test prices and live prices never mix.
 */
const addonPriceCache = new WeakMap<
  Stripe,
  Map<string, { priceId: string; expiresAt: number }>
>();
const ADDON_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function getAddonPriceId(
  addon: string,
  stripe: Stripe = getStripeDev(),
): Promise<string> {
  let perInstance = addonPriceCache.get(stripe);
  if (!perInstance) {
    perInstance = new Map();
    addonPriceCache.set(stripe, perInstance);
  }
  const cached = perInstance.get(addon);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.priceId;
  }

  // Stripe paginates at 100 by default; with single-digit add-ons we
  // never need pagination here.
  const prices = await stripe.prices.list({
    active: true,
    limit: 100,
    expand: ['data.product'],
  });

  const match = prices.data.find((p) => {
    const product = p.product as Stripe.Product | string;
    if (typeof product === 'string') return false;
    return product.metadata?.addon === addon;
  });

  if (!match) {
    throw new Error(
      `No active Stripe price found for addon="${addon}". ` +
        `Create the product in the Stripe Dashboard with metadata.addon="${addon}".`,
    );
  }

  perInstance.set(addon, {
    priceId: match.id,
    expiresAt: Date.now() + ADDON_CACHE_TTL_MS,
  });
  return match.id;
}

/**
 * Convenience wrapper for the deposits add-on. Same dynamic lookup;
 * kept for ergonomics in call sites that don't need a generic helper.
 *
 * Falls back to the legacy env var (STRIPE_DEPOSITS_ADDON_PRICE_ID*)
 * when the dynamic lookup fails — useful during the migration to make
 * sure existing dev setups don't break before the metadata is added.
 */
export async function getDepositsAddonPriceId(
  stripe?: Stripe,
): Promise<string> {
  try {
    return await getAddonPriceId('deposits', stripe);
  } catch (err) {
    const fallback =
      process.env.STRIPE_DEPOSITS_ADDON_PRICE_ID_DEV ||
      process.env.STRIPE_DEPOSITS_ADDON_PRICE_ID;
    if (fallback) {
      console.warn(
        `[stripe] dynamic addon lookup failed, using env fallback: ${err instanceof Error ? err.message : err}`,
      );
      return fallback;
    }
    throw err;
  }
}

/**
 * Returns the list of webhook signing secrets to try, in priority order.
 *
 * Stripe ships platform events and Connect events on separate endpoint
 * registrations — each with its own signing secret — even when both
 * point at the same URL. Deposit Checkout Sessions live on connected
 * accounts, so their `checkout.session.*` events come through the
 * Connect stream and need the Connect secret to verify.
 *
 *   - STRIPE_WEBHOOK_SECRET             → platform events (prod + dev)
 *   - STRIPE_WEBHOOK_SECRET_CONNECT     → Connect events (prod)
 *   - STRIPE_WEBHOOK_SECRET_DEV         → platform events (local stripe listen)
 *   - STRIPE_WEBHOOK_SECRET_DEV_CONNECT → Connect events (local stripe listen
 *                                         --forward-connect-to)
 *
 * The webhook handler iterates over this list and accepts whichever
 * secret verifies the signature, so a single endpoint can serve both
 * platform and Connect streams.
 */
export function getWebhookSecrets(): string[] {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET_DEV,
    process.env.STRIPE_WEBHOOK_SECRET_DEV_CONNECT,
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  ].filter((s): s is string => !!s);

  if (secrets.length === 0) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  return secrets;
}

/** @deprecated Prefer getWebhookSecrets() — kept for backwards compat. */
export function getWebhookSecret(): string {
  return getWebhookSecrets()[0];
}
