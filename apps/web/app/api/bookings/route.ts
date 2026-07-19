// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { bookingService, providerService } from '@booking-app/firebase';
import {
  createBookingSchema,
  isAccessOverrideActive,
  isLoyaltyConfigValid,
  isLoyaltyRewardArmed,
  hasLoyaltyAccess,
  getClientKey,
} from '@booking-app/shared';
import { ZodError } from 'zod';
import { getStripeDev } from '@/lib/stripe';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sendDepositPaymentRequestEmail } from '@/lib/emails/depositPaymentRequest';

// Stripe Checkout Sessions require expires_at to be at least 30 minutes
// in the future. We use that minimum so the slot is held for as little
// time as possible while the client completes payment.
const CHECKOUT_EXPIRY_MIN_SECONDS = 30 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input. Note: we deliberately DON'T pass clientId into the
    // schema/service. The booking repository uses the client Firestore
    // SDK (not Admin), and the firestore.rules enforce that any write
    // with a non-null clientId must come from an authenticated request
    // matching that uid — but the API has no auth context. So we let
    // the booking land with clientId=null, then patch it via the Admin
    // SDK below (which bypasses rules).
    const validated = createBookingSchema.parse({
      providerId: body.providerId,
      serviceId: body.serviceId,
      memberId: body.memberId || null,
      locationId: body.locationId,
      datetime: new Date(body.datetime),
      clientInfo: body.clientInfo,
      // Variations/options chosen by the client. The booking service
      // recomputes price + duration from these server-side.
      selections: body.selections,
      // Multi-prestation cart: when present, the booking spans all items
      // (price/duration aggregated server-side). Without this the booking
      // would silently fall back to the single top-level serviceId.
      items: body.items,
    });
    const clientUid: string | null =
      typeof body.clientId === 'string' && body.clientId.length > 0
        ? body.clientId
        : null;

    // Check provider subscription is active before accepting booking
    const providerData = await providerService.getById(validated.providerId);
    if (!providerData) {
      return NextResponse.json(
        { error: 'Ce prestataire n\'existe pas' },
        { status: 404 }
      );
    }

    if (!providerData.isPublished) {
      return NextResponse.json(
        { error: 'Ce prestataire n\'accepte pas de réservations pour le moment' },
        { status: 403 }
      );
    }

    const isSubscriptionValid =
      isAccessOverrideActive(providerData.accessOverride) ||
      (providerData.plan !== 'trial' && providerData.subscription.status !== 'cancelled' && providerData.subscription.status !== 'incomplete') ||
      (providerData.plan === 'trial' && new Date() <= providerData.subscription.validUntil);

    if (!isSubscriptionValid) {
      return NextResponse.json(
        { error: 'Ce prestataire n\'accepte pas de réservations pour le moment' },
        { status: 403 }
      );
    }

    // Pro-side manual bookings (planning drawer). Two sub-modes:
    //   - askDeposit:false → skip the deposit, mark confirmed (pro will
    //                        collect in person).
    //   - askDeposit:true  → run the normal deposit flow but, instead of
    //                        redirecting the pro to Stripe Checkout,
    //                        email the client a payment link.
    const isProSource = body.source === 'pro';
    const proAsksDeposit = isProSource && body.askDeposit === true;
    const skipDeposit = isProSource && !proAsksDeposit;

    // Client bookings must respect the provider's max booking advance window.
    // Pro manual bookings are exempt — the pro can schedule further ahead for
    // their own agenda. (UI already caps the calendar; this is the server guard.)
    if (!isProSource) {
      const maxAdvanceDays = providerData.settings?.maxBookingAdvance ?? 60;
      const latest = new Date();
      latest.setHours(0, 0, 0, 0);
      latest.setDate(latest.getDate() + maxAdvanceDays);
      latest.setHours(23, 59, 59, 999);
      if (validated.datetime > latest) {
        return NextResponse.json(
          { error: `Les réservations ne sont possibles que jusqu'à ${maxAdvanceDays} jours à l'avance.` },
          { status: 400 }
        );
      }
    }

    // Mobile clients use Stripe PaymentSheet (native UI) instead of the
    // hosted Checkout web page. We detect this via an explicit flag and
    // create a PaymentIntent + ephemeral key the SDK can consume.
    const isMobileClient = body.source === 'mobile';

    // ── Carte de fidélité ────────────────────────────────────────
    // Armée quand le compteur de RDV honorés du client chez ce pro est un
    // multiple du seuil. Le compteur vit dans providerClients/{providerId}_
    // {clientKey} (tenu par le trigger onBookingWrite) — lecture via l'Admin
    // SDK : la route n'a pas de contexte auth et les rules réservent ces
    // docs au pro. Jamais sur les résas créées par le pro lui-même
    // (isProSource) : la fidélité récompense les réservations du client.
    let loyaltySettings = null;
    // `clientUid` requis : la fidélité vit dans l'app — les invités ne
    // cumulent NI ne consomment (politique 2026-07-20). Sans ce garde, un
    // client armé pourrait consommer sa récompense en boucle via des résas
    // invitées (qui n'incrémentent pas le compteur).
    if (
      !isProSource &&
      clientUid &&
      isLoyaltyConfigValid(providerData.settings?.loyalty) &&
      hasLoyaltyAccess(providerData)
    ) {
      // MÊME clé que le trigger qui tient les compteurs (email prioritaire,
      // id: en secours) — sinon on lirait un doc qui n'existe pas.
      const clientKey = getClientKey({
        clientId: clientUid,
        clientInfo: validated.clientInfo ?? null,
      } as Parameters<typeof getClientKey>[0]);
      if (clientKey !== 'anonymous') {
        try {
          const snap = await getAdminFirestore()
            .collection('providerClients')
            .doc(`${validated.providerId}_${clientKey}`)
            .get();
          // Compteur FIDÉLITÉ (pas confirmedCount) : connecté + post-lancement.
          const confirmedCount = (snap.data()?.loyaltyConfirmedCount as number | undefined) ?? 0;
          if (isLoyaltyRewardArmed(confirmedCount, providerData.settings!.loyalty!.threshold)) {
            loyaltySettings = providerData.settings!.loyalty!;
          }
        } catch (e) {
          // La fidélité ne doit JAMAIS bloquer une réservation.
          console.error('[bookings] loyalty lookup failed:', e);
        }
      }
    }

    // Create booking
    // Emails (client confirmation + provider notification) are sent automatically
    // by the onBookingWrite Cloud Function trigger via handleBookingEmails()
    const booking = await bookingService.createBooking(validated, {
      skipDeposit,
      loyalty: loyaltySettings,
    });

    // ─────────────────────────────────────────────────────────────────
    // Backward-compat guard for old mobile builds.
    //
    // Older versions of the mobile app (predating the deposit flow)
    // don't know how to drive the Stripe PaymentSheet, so they'd
    // silently leave the booking in `pending_payment` forever and
    // ghost the user. Recent builds advertise their support via
    // `clientCapabilities: ['deposit']`. When mobile + deposit
    // required + capability missing, we delete the just-created
    // doc (no side effects: pending_payment defers both emails and
    // push) and return 426 with a code the new client recognises
    // to show an "update Opatam" dialog.
    //
    // Web clients don't need this guard — they're stateless and
    // always run the latest code.
    // ─────────────────────────────────────────────────────────────────
    if (booking.status === 'pending_payment' && isMobileClient) {
      const caps = Array.isArray(body.clientCapabilities)
        ? (body.clientCapabilities as string[])
        : [];
      if (!caps.includes('deposit')) {
        try {
          await getAdminFirestore()
            .collection('bookings')
            .doc(booking.id)
            .delete();
        } catch (err) {
          console.error(
            '[bookings] failed to roll back legacy-client booking:',
            err,
          );
        }
        return NextResponse.json(
          {
            error:
              "Cette prestation nécessite un acompte. Mettez à jour Opatam pour réserver.",
            code: 'CLIENT_UPGRADE_REQUIRED',
          },
          { status: 426 },
        );
      }
    }

    // Stamp the clientId via Admin SDK (bypasses Firestore rules — see
    // note above the schema parse). Without this the booking is invisible
    // to "Mes rendez-vous" since useClientBookings queries by clientId.
    if (clientUid) {
      await getAdminFirestore()
        .collection('bookings')
        .doc(booking.id)
        .update({ clientId: clientUid });
      booking.clientId = clientUid;
    }

    // Deposit path: status=pending_payment + booking.deposit populated.
    // Spin up a Stripe Checkout Session on the provider's connected
    // account so the funds land directly on their IBAN.
    if (
      booking.status === 'pending_payment' &&
      booking.deposit &&
      providerData.stripeConnectAccountId
    ) {
      const stripe = getStripeDev();
      const stripeAccountOpts = {
        stripeAccount: providerData.stripeConnectAccountId,
      } as const;

      // Mobile native flow → Stripe PaymentSheet via Destination Charges.
      //
      // Why destination instead of direct charges (which the web uses):
      // the React Native SDK's `useStripe()` hook can't switch accounts
      // per call — `stripeAccountId` is only on the top-level
      // `StripeProvider`. Remounting it per booking is hostile.
      //
      // Destination charges sidestep this entirely: the PaymentIntent
      // and Customer live on the platform, and `transfer_data` routes
      // the funds to the pro's connected account. PaymentSheet works
      // with zero special config.
      //
      // The trade-off: bank statement shows "Opatam" (platform) instead
      // of the pro's brand. Acceptable since the customer booked
      // through the Opatam app — they expect the platform name.
      if (isMobileClient) {
        try {
          const customer = await stripe.customers.create({
            email: booking.clientInfo.email,
            name: booking.clientInfo.name,
          });

          const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            { apiVersion: '2025-04-30.basil' },
          );

          const paymentIntent = await stripe.paymentIntents.create({
            amount: booking.deposit.amount,
            currency: 'eur',
            customer: customer.id,
            automatic_payment_methods: { enabled: true },
            description: `Acompte — ${booking.serviceName} chez ${booking.providerName}`,
            transfer_data: {
              destination: providerData.stripeConnectAccountId,
            },
            metadata: {
              bookingId: booking.id,
              providerId: booking.providerId,
              serviceId: booking.serviceId,
              depositAmount: String(booking.deposit.amount),
            },
          });

          // connectAccountId stays NULL → tells the refund helper to
          // refund on the platform (no Stripe-Account header).
          await getAdminFirestore()
            .collection('bookings')
            .doc(booking.id)
            .update({
              'deposit.paymentIntentId': paymentIntent.id,
            });

          return NextResponse.json(
            {
              bookingId: booking.id,
              requiresPayment: true,
              // PaymentSheet expects these fields exactly:
              paymentIntent: paymentIntent.client_secret,
              ephemeralKey: ephemeralKey.secret,
              customer: customer.id,
              depositAmount: booking.deposit.amount,
            },
            { status: 201 },
          );
        } catch (err) {
          console.error('[BOOKINGS] PaymentIntent creation failed:', err);
          await getAdminFirestore()
            .collection('bookings')
            .doc(booking.id)
            .delete()
            .catch(() => {});
          return NextResponse.json(
            {
              error:
                "Impossible d'initialiser le paiement de l'acompte. Veuillez réessayer.",
            },
            { status: 502 },
          );
        }
      }

      // Web flow → Stripe Checkout (hosted page).
      try {
        const expiresAt =
          Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_MIN_SECONDS;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
        const successUrl = `${appUrl}/reservation/confirmation/${booking.id}?deposit=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${appUrl}/p/${providerData.slug}/reserver?deposit=cancelled`;

        const session = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            expires_at: expiresAt,
            customer_email: booking.clientInfo.email,
            line_items: [
              {
                price_data: {
                  currency: 'eur',
                  unit_amount: booking.deposit.amount,
                  product_data: {
                    name: `Acompte — ${booking.serviceName}`,
                    description: `Réservation chez ${booking.providerName}`,
                  },
                },
                quantity: 1,
              },
            ],
            metadata: {
              bookingId: booking.id,
              providerId: booking.providerId,
              serviceId: booking.serviceId,
              depositAmount: String(booking.deposit.amount),
            },
            payment_intent_data: {
              metadata: {
                bookingId: booking.id,
                providerId: booking.providerId,
              },
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
          },
          { stripeAccount: providerData.stripeConnectAccountId },
        );

        // Stash session id + URL — the URL stays valid until expires_at
        // (~30 min) so the cron reminder can re-send it if needed. Web
        // flow uses Direct charges, so the connected account ID is
        // stored too — the refund helper uses it to scope the refund.
        await getAdminFirestore()
          .collection('bookings')
          .doc(booking.id)
          .update({
            'deposit.checkoutSessionId': session.id,
            'deposit.checkoutUrl': session.url,
            'deposit.connectAccountId': providerData.stripeConnectAccountId,
          });

        if (proAsksDeposit && session.url) {
          // Pro-initiated booking: client wasn't on the page, so we email
          // them the Checkout link. Fire-and-forget — booking creation
          // succeeded regardless of email delivery.
          sendDepositPaymentRequestEmail({
            clientEmail: booking.clientInfo.email,
            clientName: booking.clientInfo.name,
            serviceName: booking.serviceName,
            datetime: booking.datetime,
            duration: booking.duration,
            depositAmount: booking.deposit.amount,
            providerName: booking.providerName,
            checkoutUrl: session.url,
            minutesToPay: Math.round(CHECKOUT_EXPIRY_MIN_SECONDS / 60),
            cancelToken: booking.cancelToken,
            // Language the client booked in (absent on pro-created bookings → fr).
            locale: booking.clientLocale ?? null,
          }).catch((err) =>
            console.error('[BOOKINGS] deposit-request email failed:', err),
          );

          return NextResponse.json(
            {
              bookingId: booking.id,
              paymentRequested: true,
            },
            { status: 201 },
          );
        }

        return NextResponse.json(
          {
            bookingId: booking.id,
            requiresPayment: true,
            checkoutUrl: session.url,
          },
          { status: 201 },
        );
      } catch (err) {
        // Checkout creation failed — roll the booking back so the slot
        // doesn't sit reserved with no way for the client to pay.
        console.error('[BOOKINGS] Checkout session creation failed:', err);
        await getAdminFirestore()
          .collection('bookings')
          .doc(booking.id)
          .delete()
          .catch(() => {});
        return NextResponse.json(
          {
            error:
              "Impossible d'initialiser le paiement de l'acompte. Veuillez réessayer.",
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({ bookingId: booking.id }, { status: 201 });
  } catch (error) {
    console.error('Booking creation error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
