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
