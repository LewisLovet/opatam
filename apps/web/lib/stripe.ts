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
