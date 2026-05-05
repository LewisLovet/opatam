/**
 * POST /api/dev/deposits-playground/stripe-trigger
 *
 * Spawns `stripe trigger <event>` on the host so the resulting
 * Stripe TEST event flows through `stripe listen` and into our
 * webhook handler exactly like a real prod event would. Useful to
 * exercise the signature verification + routing layers that the
 * direct-Firestore-mutation playground bypasses.
 *
 * Body:
 *   { bookingId: string, event: 'payment_success' | … }
 *
 * The bookingId is injected into the event metadata via Stripe
 * CLI's --add flag so the webhook handler can find the matching
 * playground booking and mutate it.
 *
 * Limits:
 *   - Requires the `stripe` CLI in $PATH on the host machine.
 *   - Requires `stripe listen` to be running (otherwise the event
 *     fires on Stripe's side but never reaches localhost).
 *   - For `refund` / `dispute_created`, Stripe trigger fabricates
 *     a brand-new PaymentIntent that doesn't match our playground
 *     booking → the handler logs "no booking found" and exits
 *     cleanly. That's fine — we're testing routing, not data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

interface TriggerBody {
  bookingId: string;
  event:
    | 'payment_success'
    | 'payment_expired'
    | 'payment_failed'
    | 'refund'
    | 'dispute_created';
}

interface TriggerSpec {
  stripeEvent: string;
  /**
   * Tuples of (object, key, value) that get passed as `--add object:key=value`
   * to inject our bookingId into the right place on the fabricated event.
   */
  overrides: Array<{ object: string; key: string; value: string }>;
}

function buildTriggerSpec(
  event: TriggerBody['event'],
  bookingId: string,
): TriggerSpec {
  switch (event) {
    case 'payment_success':
      return {
        stripeEvent: 'checkout.session.completed',
        overrides: [
          { object: 'checkout_session', key: 'metadata.bookingId', value: bookingId },
        ],
      };
    case 'payment_expired':
      return {
        stripeEvent: 'checkout.session.expired',
        overrides: [
          { object: 'checkout_session', key: 'metadata.bookingId', value: bookingId },
        ],
      };
    case 'payment_failed':
      return {
        stripeEvent: 'payment_intent.payment_failed',
        overrides: [
          { object: 'payment_intent', key: 'metadata.bookingId', value: bookingId },
        ],
      };
    case 'refund':
      // charge.refunded fabricates its own PaymentIntent so the
      // handler won't find the playground booking — but we still
      // exercise the signature + routing path.
      return { stripeEvent: 'charge.refunded', overrides: [] };
    case 'dispute_created':
      return { stripeEvent: 'charge.dispute.created', overrides: [] };
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as TriggerBody;
  if (!body.bookingId || !body.event) {
    return NextResponse.json(
      { error: 'bookingId et event requis' },
      { status: 400 },
    );
  }

  const spec = buildTriggerSpec(body.event, body.bookingId);
  const args = ['trigger', spec.stripeEvent];
  for (const o of spec.overrides) {
    args.push('--add', `${o.object}:${o.key}=${o.value}`);
  }

  // Stripe CLI is typically installed via Homebrew. Node child_process
  // gets a minimal PATH on macOS, so we extend it to include the usual
  // Homebrew bin dirs.
  const env = {
    ...process.env,
    PATH: `${process.env.PATH ?? ''}:/opt/homebrew/bin:/usr/local/bin:/usr/bin`,
  };

  try {
    const { stdout, stderr } = await exec('stripe', args, {
      env,
      timeout: 15000,
    });
    return NextResponse.json({
      ok: true,
      command: ['stripe', ...args].join(' '),
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
    };
    const isMissing = e.code === 'ENOENT';
    return NextResponse.json(
      {
        ok: false,
        error: isMissing
          ? "La CLI `stripe` n'est pas dans le PATH du process. Installe-la (brew install stripe/stripe-cli/stripe) ou redémarre `next dev` depuis un shell où `which stripe` répond."
          : e.message,
        command: ['stripe', ...args].join(' '),
        stdout: e.stdout?.trim() ?? '',
        stderr: e.stderr?.trim() ?? '',
      },
      { status: isMissing ? 500 : 502 },
    );
  }
}
