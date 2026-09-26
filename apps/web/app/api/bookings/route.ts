// Force Paris timezone before any Date operation (Vercel runs in UTC)
process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { bookingService, providerService } from '@booking-app/firebase';
import {
  createBookingSchema,
  isAccessOverrideActive,
  computeEntitlements,
  isLoyaltyConfigValid,
  isLoyaltyRewardArmed,
  hasLoyaltyAccess,
  clientServiceFee,
  DEFAULT_CURRENCY,
  formatPrice,
} from '@booking-app/shared';
import type Stripe from 'stripe';
import { ZodError } from 'zod';
import { getStripeDev } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { loyaltyRedemptionKey, resolveLoyaltyCard } from '@/lib/loyalty-identity';
import { sendDepositPaymentRequestEmail } from '@/lib/emails/depositPaymentRequest';
import { resolvePlace } from '@/lib/google-places';
import { computeTravelQuote, verifyTravelQuote } from '@/lib/travel';
import { MapboxUnavailableError } from '@/lib/mapbox';

// Stripe Checkout Sessions require expires_at to be at least 30 minutes
// in the future. We use that minimum so the slot is held for as little
// time as possible while the client completes payment.
const CHECKOUT_EXPIRY_MIN_SECONDS = 30 * 60;

/**
 * Compte Firebase du CLIENT pour lequel le prestataire saisit un rendez-vous.
 *
 * Appelé UNIQUEMENT depuis une requête pro authentifiée : c'est le
 * prestataire qui atteste l'identité de sa cliente, et il ne peut le faire
 * que pour lui-même (son UID est celui du document prestataire).
 *
 * Deux sources, dans cet ordre :
 *  1. sa propre fiche client, si elle porte déjà un `clientId` — c'est la
 *     preuve la plus forte, la cliente a déjà réservé connectée ici ;
 *  2. à défaut, le compte correspondant à l'adresse saisie. Même règle de
 *     correspondance d'email que le rattachement des réservations
 *     invitées, appliquée ici à la déclaration d'un pro identifié.
 *
 * Sans compte à cette adresse, on ne rattache rien : la réservation existe,
 * elle ne remplit simplement aucune carte — la fidélité suppose un compte.
 */
async function resolveClientAccount(
  providerId: string,
  email: string | null,
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const db = getAdminFirestore();
  try {
    const doc = await db
      .collection('providerClients')
      .doc(`${providerId}_email:${normalized}`)
      .get();
    const owner = doc.data()?.clientId as string | undefined;
    if (owner) return owner;
  } catch {
    // Fiche absente ou illisible → on tente la résolution par compte.
  }
  try {
    const account = await getAdminAuth().getUserByEmail(normalized);
    return account?.uid ?? null;
  } catch {
    return null; // aucun compte à cette adresse — cas le plus fréquent
  }
}

/**
 * Pays du compte Stripe connecte, pour Apple Pay et Google Pay.
 *
 * En paiement direct le MARCHAND est le prestataire : les deux portefeuilles
 * refusent un pays qui ne correspond pas a celui du compte qui encaisse.
 * On le lit donc chez Stripe et non dans le profil : les comptes crees avant
 * la correction du pays sont francais quoi que declare le prestataire, et
 * Stripe n'autorise pas a changer le pays d'un compte existant.
 *
 * Repli sur la France en cas d'echec : c'est le pays de la grande majorite
 * des comptes, et un portefeuille indisponible vaut mieux qu'un tunnel qui
 * s'arrete. La carte, elle, marche dans tous les cas.
 */
async function paysDuCompteConnecte(
  stripe: Stripe,
  accountId: string,
): Promise<string> {
  try {
    const compte = await stripe.accounts.retrieve(accountId);
    return (compte.country ?? 'FR').toUpperCase();
  } catch (err) {
    console.error('[BOOKINGS] pays du compte connecte illisible:', err);
    return 'FR';
  }
}

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
      // Langue de l'app/du site au moment de la résa — pilote les emails
      // client (fix audit P2.4 : le champ était accepté par le schéma mais
      // jamais transmis, cassant la chaîne bilingue web ET mobile).
      clientLocale: body.clientLocale,
      // Multi-prestation cart: when present, the booking spans all items
      // (price/duration aggregated server-side). Without this the booking
      // would silently fall back to the single top-level serviceId.
      items: body.items,
      // Prestation à domicile (même piège P2.4 : sans ce remapping explicite,
      // le champ validé par le schéma n'atteindrait jamais le serveur).
      clientAddress: body.clientAddress,
      travelQuoteToken: body.travelQuoteToken,
    });
    // ── Identité client (audit P1.1) ─────────────────────────────
    // `clientUid` = uid VÉRIFIÉ via le Firebase ID token (Authorization:
    // Bearer). C'est LA seule identité utilisée par la fidélité (cumul +
    // consommation). `legacyClientId` = body.clientId non vérifié, conservé
    // UNIQUEMENT pour rattacher la résa à « Mes rendez-vous » sur les
    // anciens builds mobile qui n'envoient pas encore le token.
    // TODO(loyalty-adoption) : supprimer legacyClientId quand les builds
    // pré-fidélité auront disparu.
    let verifiedUid: string | null = null;
    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
        verifiedUid = decoded.uid;
      } catch {
        // Token invalide/expiré → on traite la requête comme invitée
        // (jamais bloquant : le tunnel web n'envoie pas de token).
        verifiedUid = null;
      }
    }
    const legacyClientId: string | null =
      typeof body.clientId === 'string' && body.clientId.length > 0 ? body.clientId : null;
    const clientUid: string | null = verifiedUid ?? legacyClientId;

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

    // Droits calculés — LA règle unique (payant, essai en cours, ou accès
    // offert actif). L'ancien test lisait `plan`, que l'octroi d'un comp
    // mutait ; il ne mute plus, donc seuls les droits dérivés font foi.
    // Devise du prestataire : elle decide de ce que la cliente est debitee.
    // Absente = euro, donc rien ne change pour les comptes existants.
    /**
     * Devise du PAIEMENT, en minuscules pour Stripe.
     *
     * C'est celle FIGEE sur la reservation, pas le reglage du jour : une
     * reservation creee hier et payee aujourd'hui ne doit pas changer de
     * devise parce que le prestataire a touche a ses parametres entre les
     * deux. Repli sur le prestataire puis l'euro pour l'historique.
     */
    const deviseDeLaResa = (b?: { currency?: string } | null): string =>
      (b?.currency ?? providerData.currency ?? DEFAULT_CURRENCY).toLowerCase();

    const isSubscriptionValid = computeEntitlements(providerData).canReceiveBookings;

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
    // Le mode pro accorde de vrais privilèges — sauter l'acompte, ignorer
    // la fenêtre de réservation maximale. Il doit donc être PROUVÉ : le
    // document prestataire a pour identifiant l'UID de son propriétaire,
    // il suffit de comparer.
    //
    // Tolérance transitoire : les écrans pro déjà déployés n'envoient pas
    // encore de jeton, et refuser leurs réservations casserait le
    // planning en production. On les accepte donc encore, en le
    // journalisant — mais ce qui est NOUVEAU (rattacher le compte du
    // client pour la fidélité) exige la preuve. À resserrer quand les
    // clients à jour auront remplacé les anciens.
    const isProVerified = isProSource && verifiedUid === validated.providerId;
    if (isProSource && !isProVerified) {
      console.warn(
        `[bookings] source=pro NON authentifiée (provider ${validated.providerId}) — ` +
          'client non rattaché, à refuser une fois les écrans pro à jour',
      );
    }
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
    let loyaltyRedemptionRef: FirebaseFirestore.DocumentReference | null = null;
    // Fidélité : uid VÉRIFIÉ requis (audit P1.1 — jamais legacyClientId).
    // Comptage LIVE depuis les résas (règle « confirmé ET passé » : le
    // compteur stocké peut retarder d'un jour), et consommation ATOMIQUE
    // par ticket de cycle (audit P1.2 — une carte pleine = UNE réduction,
    // quels que soient le timing ou le statut des résas suivantes).
    if (
      !isProSource &&
      verifiedUid &&
      isLoyaltyConfigValid(providerData.settings?.loyalty) &&
      hasLoyaltyAccess(providerData)
    ) {
      // Identité de la carte : l'UID, JAMAIS l'email du formulaire. Un
      // client qui réserve tantôt avec l'adresse de son compte, tantôt avec
      // une autre, avait deux cartes chez le même pro — l'une activée,
      // l'autre qui se remplissait. Voir `lib/loyalty-identity`.
      try {
        const adminDb = getAdminFirestore();
        const threshold = providerData.settings!.loyalty!.threshold;
        // Fidélité v2 : la carte doit être ACTIVÉE par le client pour
        // consommer une récompense, et le compte effectif inclut le delta
        // manuel posé par le pro — l'un comme l'autre réunis sur TOUTES les
        // fiches de ce client chez ce pro.
        const card = await resolveLoyaltyCard(adminDb, validated.providerId, verifiedUid);
        const cardActivated = card.activated;
        const manualAdjustment = card.adjustment;
        // Comptage live : mêmes conditions que l'agrégateur (confirmée +
        // connectée + post-lancement + RDV passé). Requête par `clientId`
        // et non par email : le filtre exigeait déjà un compte, l'ensemble
        // obtenu est donc le même — à ceci près qu'il couvre maintenant
        // TOUTES les adresses utilisées par ce client.
        const now = Date.now();
        const launch = new Date('2026-07-20T00:00:00+02:00').getTime();
        const bookingsSnap = await adminDb
          .collection('bookings')
          .where('providerId', '==', validated.providerId)
          .where('clientId', '==', verifiedUid)
          .get();
        const computed = bookingsSnap.docs.filter((d) => {
          const b = d.data();
          const createdAt = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
          const datetime = b.datetime?.toDate?.()?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
          return b.status === 'confirmed' && createdAt >= launch && datetime <= now;
        }).length;
        const count = Math.max(0, computed + manualAdjustment);

        if (cardActivated && isLoyaltyRewardArmed(count, threshold)) {
          // Ticket de rédemption — un par cycle de carte. Transaction : si
          // le ticket existe déjà (résa réduite en cours, même pas encore
          // passée), la récompense est déjà consommée → pas de deuxième
          // réduction.
          const cycle = count / threshold;
          const clientKey = loyaltyRedemptionKey(verifiedUid);
          const ref = adminDb
            .collection('loyaltyRedemptions')
            .doc(`${validated.providerId}_${clientKey}_c${cycle}`);
          // Tickets hérités : avant l'unification, la clé dérivait de
          // l'email. Un cycle déjà consommé sous l'ancienne clé ne doit pas
          // rouvrir droit à une réduction.
          const legacyRefs = card.all
            .map((c) => c.clientKey)
            .filter((k) => k !== clientKey)
            .map((k) =>
              adminDb
                .collection('loyaltyRedemptions')
                .doc(`${validated.providerId}_${k}_c${cycle}`),
            );
          const created = await adminDb.runTransaction(async (tx) => {
            const snaps = await Promise.all([ref, ...legacyRefs].map((r) => tx.get(r)));
            if (snaps.some((snap) => snap.exists)) return false;
            tx.set(ref, {
              providerId: validated.providerId,
              clientKey,
              clientId: verifiedUid,
              cycle,
              threshold,
              createdAt: new Date(),
              bookingId: null,
            });
            return true;
          });
          if (created) {
            loyaltySettings = providerData.settings!.loyalty!;
            loyaltyRedemptionRef = ref;
          }
        }
      } catch (e) {
        // La fidélité ne doit JAMAIS bloquer une réservation.
        console.error('[bookings] loyalty lookup failed:', e);
      }
    }

    // ── Frais de déplacement (lieu mobile avec zone configurée) ─────────
    // Tout est recalculé/validé SERVEUR : le placeId est résolu par la clé
    // serveur (jamais confiance au texte du formulaire), le devis signé de
    // /api/travel/quote évite un second appel Mapbox, et l'adresse EXACTE
    // est écrite en sous-collection privée AVANT la création — un booking
    // à domicile sans adresse ne peut pas exister.
    const travelPrep = await prepareTravelForBooking(validated, isProVerified);
    if ('response' in travelPrep) return travelPrep.response;

    // Create booking
    // Emails (client confirmation + provider notification) are sent automatically
    // by the onBookingWrite Cloud Function trigger via handleBookingEmails()
    let booking;
    try {
      booking = await bookingService.createBooking(validated, {
        skipDeposit,
        loyalty: loyaltySettings,
        // Le pro AUTHENTIFIÉ peut inscrire un rendez-vous sur une prestation
        // qu'il a rendue indisponible : l'indisponibilité vise la réservation
        // en ligne, pas l'appel téléphonique. `isProSource` seul ne suffirait
        // pas — c'est une simple valeur envoyée par le client.
        allowUnavailable: isProVerified,
        skipTravel: isProVerified,
        travel: travelPrep.travel,
        bookingId: travelPrep.bookingId,
        // D'où vient la réservation. L'information transitait déjà ici sans
        // jamais être conservée : sans elle, impossible de savoir dans quel
        // fuseau un rendez-vous ancien a été calculé.
        createdVia: isProSource ? 'pro' : isMobileClient ? 'mobile' : 'client',
      });
    } catch (e) {
      // Création refusée après l'écriture de l'adresse privée → nettoyage
      // best-effort (un doc privé orphelin est inoffensif : Admin-only).
      if (travelPrep.privateAddressRef) {
        await travelPrep.privateAddressRef.delete().catch(() => undefined);
      }
      // Résa refusée après réservation du ticket → on le libère pour que
      // la récompense reste disponible.
      if (loyaltyRedemptionRef) await loyaltyRedemptionRef.delete().catch(() => undefined);
      throw e;
    }
    if (loyaltyRedemptionRef) {
      if (booking.loyalty) {
        await loyaltyRedemptionRef.update({ bookingId: booking.id }).catch(() => undefined);
      } else {
        // La réduction n'a finalement pas été appliquée (ex. promo meilleure
        // sur toutes les lignes, aucune presta éligible) → ticket libéré.
        await loyaltyRedemptionRef.delete().catch(() => undefined);
      }
    }

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
    if (isProVerified) {
      // RÉSERVATION SAISIE PAR LE PRO. `clientUid` vaut ici l'UID du PRO
      // (c'est lui qui porte le jeton) — l'écrire serait attribuer le
      // rendez-vous au prestataire lui-même. On résout donc le compte du
      // CLIENT, pour que ses points se cumulent (décision produit : une
      // réservation prise au salon compte, même si le client n'a pas
      // utilisé l'app).
      const attachedUid = await resolveClientAccount(
        validated.providerId,
        validated.clientInfo?.email ?? null,
      );
      if (attachedUid) {
        await getAdminFirestore()
          .collection('bookings')
          .doc(booking.id)
          .update({ clientId: attachedUid });
        booking.clientId = attachedUid;
      }
    } else if (clientUid) {
      // verifiedUid en priorité ; legacyClientId (non vérifié) seulement en
      // secours pour « Mes rendez-vous » des anciens builds — voir P1.1.
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

      // Mobile native flow → Stripe PaymentSheet en PAIEMENT DIRECT, comme
      // le web. Client, cle ephemere et PaymentIntent vivent sur le compte
      // du prestataire ; les frais Opatam remontent par
      // `application_fee_amount`.
      //
      // Ce flux etait en destination charges, au motif que le SDK React
      // Native ne peut pas changer de compte par appel — `stripeAccountId`
      // n'existe que sur `StripeProvider`. C'est vrai du COMPOSANT, mais le
      // SDK exporte aussi `initStripe()`, qui appelle le meme `initialise`
      // natif de facon imperative : l'app bascule donc le SDK sur le compte
      // du pro juste avant d'ouvrir la feuille, sans rien remonter.
      //
      // Trois consequences, toutes voulues :
      //   - le prestataire supporte les FRAIS REELS de Stripe, preleves par
      //     Stripe sur son compte, au lieu d'une estimation maison qu'on
      //     deduisait du transfert ;
      //   - il devient le marchand : le releve bancaire de la cliente porte
      //     son enseigne, plus « Opatam » ;
      //   - `deposit.connectAccountId` est desormais renseigne, ce qui suffit
      //     a router le remboursement sur le bon compte (voir
      //     `refund-deposit.ts`, qui branche deja sur ce champ). Les
      //     reservations d'AVANT gardent le champ vide et donc l'ancienne
      //     voie : rien a migrer.
      //
      // PREREQUIS DE DEPLOIEMENT : `payment_intent.succeeded` doit etre
      // abonne sur le point de terminaison CONNECT. En direct, l'evenement
      // arrive du compte du prestataire et non plus de la plateforme ; sans
      // cet abonnement la reservation ne passerait jamais a `confirmed`.
      if (isMobileClient) {
        try {
          const customer = await stripe.customers.create(
            {
              email: booking.clientInfo.email,
              name: booking.clientInfo.name,
            },
            stripeAccountOpts,
          );

          const ephemeralKey = await stripe.ephemeralKeys.create(
            { customer: customer.id },
            { apiVersion: '2025-04-30.basil', ...stripeAccountOpts },
          );

          // Frais de service Opatam, payés par la cliente en plus de l'acompte
          // et conservés par la plateforme (le transfert au pro ne change pas).
          const serviceFee =
          booking.deposit.serviceFee ?? clientServiceFee(booking.deposit.amount, providerData.currency);
          const deviseResa = deviseDeLaResa(booking);
          const paymentIntent = await stripe.paymentIntents.create(
            {
              amount: booking.deposit.amount + serviceFee,
              currency: deviseResa,
              customer: customer.id,
              automatic_payment_methods: { enabled: true },
              description:
                `Acompte — ${booking.serviceName} chez ${booking.providerName}` +
                // Le libelle apparait sur le releve bancaire de la cliente :
                // il doit porter la devise reellement debitee, pas l'euro.
                (serviceFee > 0
                  ? ` (dont ${formatPrice(serviceFee, booking.currency)} de frais de plateforme)`
                  : ''),
              // Frais Opatam remontes a la plateforme. Stripe preleve SES
              // propres frais sur le compte du prestataire, directement et
              // au tarif reel — plus d'estimation a deduire du transfert.
              ...(serviceFee > 0 ? { application_fee_amount: serviceFee } : {}),
              metadata: {
                bookingId: booking.id,
                providerId: booking.providerId,
                serviceId: booking.serviceId,
                depositAmount: String(booking.deposit.amount),
                serviceFee: String(serviceFee),
              },
            },
            stripeAccountOpts,
          );

          // Renseigne : dit au remboursement de se faire sur le compte du
          // prestataire, avec l'en-tete Stripe-Account.
          await getAdminFirestore()
            .collection('bookings')
            .doc(booking.id)
            .update({
              'deposit.paymentIntentId': paymentIntent.id,
              'deposit.connectAccountId': providerData.stripeConnectAccountId,
            });

          return NextResponse.json(
            {
              bookingId: booking.id,
              requiresPayment: true,
              // PaymentSheet expects these fields exactly:
              paymentIntent: paymentIntent.client_secret,
              ephemeralKey: ephemeralKey.secret,
              serviceFee,
              customer: customer.id,
              depositAmount: booking.deposit.amount,
              // Google Pay refuse un code de devise qui ne correspond pas a
              // celui du PaymentIntent : il doit venir du serveur.
              currency: deviseResa.toUpperCase(),
              // Le SDK mobile doit basculer sur ce compte avant d'ouvrir la
              // feuille : en paiement direct, le PaymentIntent n'existe pas
              // sur la plateforme.
              connectAccountId: providerData.stripeConnectAccountId,
              // Pays du compte connecte, lu chez Stripe et non deduit du
              // profil : Apple Pay et Google Pay exigent le pays du MARCHAND,
              // et le marchand est desormais le prestataire. Les comptes
              // crees avant la correction du pays sont francais quoi que dise
              // leur profil — c'est leur realite chez Stripe qui compte.
              merchantCountryCode: await paysDuCompteConnecte(
                stripe,
                providerData.stripeConnectAccountId,
              ),
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

        // Frais de service Opatam : ligne à part sur la page de paiement (la
        // cliente voit le détail avant de valider), retenus par la plateforme
        // via application_fee_amount — le pro reçoit son acompte inchangé.
        const serviceFee =
          booking.deposit.serviceFee ?? clientServiceFee(booking.deposit.amount, providerData.currency);
        const session = await stripe.checkout.sessions.create(
          {
            mode: 'payment',
            expires_at: expiresAt,
            customer_email: booking.clientInfo.email,
            line_items: [
              {
                price_data: {
                  currency: deviseDeLaResa(booking),
                  unit_amount: booking.deposit.amount,
                  product_data: {
                    name: `Acompte — ${booking.serviceName}`,
                    description: `Réservation chez ${booking.providerName}`,
                  },
                },
                quantity: 1,
              },
              ...(serviceFee > 0
                ? [
                    {
                      price_data: {
                        currency: deviseDeLaResa(booking),
                        unit_amount: serviceFee,
                        product_data: {
                          name: 'Frais de plateforme',
                        },
                      },
                      quantity: 1,
                    },
                  ]
                : []),
            ],
            metadata: {
              bookingId: booking.id,
              providerId: booking.providerId,
              serviceId: booking.serviceId,
              depositAmount: String(booking.deposit.amount),
              serviceFee: String(serviceFee),
            },
            // Sur mobile, Stripe replie les lignes derrière « Afficher les
            // détails » : cette phrase, elle, reste visible sous le bouton Payer.
            ...(serviceFee > 0
              ? {
                  custom_text: {
                    submit: {
                      message: `Ce montant comprend l'acompte de ${formatPrice(booking.deposit.amount, providerData.currency)} et ${formatPrice(serviceFee, providerData.currency)} de frais de plateforme.`,
                    },
                  },
                }
              : {}),
            payment_intent_data: {
              ...(serviceFee > 0 ? { application_fee_amount: serviceFee } : {}),
              metadata: {
                bookingId: booking.id,
                providerId: booking.providerId,
                serviceFee: String(serviceFee),
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

// ── Frais de déplacement ─────────────────────────────────────────────────────

type TravelPrep =
  | { response: NextResponse }
  | {
      travel: import('@booking-app/shared').BookingTravel | null;
      bookingId: string | undefined;
      privateAddressRef: FirebaseFirestore.DocumentReference | null;
    };

/**
 * Prépare le déplacement d'une réservation à domicile : lit la zone + son
 * origine privée, résout le placeId de la cliente côté serveur, applique le
 * devis signé (ou recalcule via Mapbox), et écrit l'adresse EXACTE dans
 * `bookings/{id}/private/clientAddress` avec un id pré-généré — AVANT la
 * création du booking (pas de résa sans adresse).
 *
 * Retourne soit `{ response }` (erreur à renvoyer telle quelle), soit le
 * snapshot public + l'id + la ref privée (pour nettoyage si la création
 * échoue ensuite).
 */
async function prepareTravelForBooking(
  validated: import('@booking-app/shared').CreateBookingInput,
  isProVerified: boolean,
): Promise<TravelPrep> {
  const none: TravelPrep = { travel: null, bookingId: undefined, privateAddressRef: null };
  // La résa manuelle du pro est exemptée (skipTravel côté service).
  if (isProVerified) return none;

  const db = getAdminFirestore();
  const locationRef = db
    .collection('providers')
    .doc(validated.providerId)
    .collection('locations')
    .doc(validated.locationId);
  const [locationSnap, originSnap] = await Promise.all([
    locationRef.get(),
    locationRef.collection('private').doc('travelOrigin').get(),
  ]);
  const location = locationSnap.data();
  const tiers = location?.travelZone;
  const origin = originSnap.data();
  const zoneActive =
    location?.type === 'mobile' && Array.isArray(tiers) && tiers.length > 0 && origin?.geopoint;
  if (!zoneActive) return none; // comportement historique, rien à faire

  const clientAddress = validated.clientAddress;
  if (!clientAddress?.placeId) {
    return {
      response: NextResponse.json(
        {
          error:
            'Ce professionnel se déplace à domicile : votre adresse est requise pour réserver.',
          code: 'ADDRESS_REQUIRED',
        },
        { status: 422 },
      ),
    };
  }

  // Le placeId fait foi : résolution SERVEUR (adresse formatée, ville, pays,
  // coordonnées). Le texte saisi dans le formulaire n'est jamais stocké.
  let place;
  try {
    place = await resolvePlace(clientAddress.placeId);
  } catch (e) {
    console.error('[bookings] resolvePlace:', e);
    return {
      response: NextResponse.json(
        { error: 'Adresse introuvable — sélectionnez-la dans les suggestions', code: 'ADDRESS_REQUIRED' },
        { status: 422 },
      ),
    };
  }
  if (location.countryCode && place.countryCode && place.countryCode !== location.countryCode) {
    return {
      response: NextResponse.json(
        { error: 'Ce professionnel ne se déplace pas dans ce pays.', code: 'OUT_OF_ZONE' },
        { status: 422 },
      ),
    };
  }

  // Devis signé de /api/travel/quote (15 min, lié au couple lieu/adresse) —
  // sinon recalcul complet.
  let fee: number;
  let distanceKm: number;
  let durationMin: number | null;
  const quote = validated.travelQuoteToken
    ? verifyTravelQuote(validated.travelQuoteToken, {
        locationId: validated.locationId,
        placeId: place.placeId,
      })
    : null;
  if (quote) {
    ({ fee, distanceKm, durationMin } = quote);
  } else {
    try {
      const computed = await computeTravelQuote(
        validated.locationId,
        origin.geopoint,
        tiers,
        place.geopoint,
      );
      if (!computed.inZone) {
        return {
          response: NextResponse.json(
            {
              error: `Cette adresse est au-delà de la zone de déplacement (${computed.maxKm} km).`,
              code: 'OUT_OF_ZONE',
              maxKm: computed.maxKm,
            },
            { status: 422 },
          ),
        };
      }
      fee = computed.fee!;
      distanceKm = computed.distanceKm!;
      durationMin = computed.durationMin;
    } catch (e) {
      if (e instanceof MapboxUnavailableError) {
        console.error('[bookings] Mapbox indisponible:', e.message);
        return {
          response: NextResponse.json(
            {
              error: 'Vérification de la distance impossible — réessayez dans quelques minutes.',
              code: 'TRAVEL_UNAVAILABLE',
            },
            { status: 503 },
          ),
        };
      }
      throw e;
    }
  }

  // Id pré-généré + adresse exacte écrite AVANT la création : un échec ici
  // = 500, pas de réservation, pas d'e-mail, pas de paiement.
  const bookingRef = db.collection('bookings').doc();
  const privateAddressRef = bookingRef.collection('private').doc('clientAddress');
  await privateAddressRef.set({
    address: place.formattedAddress,
    postalCode: place.postalCode,
    city: place.city,
    countryCode: place.countryCode,
    placeId: place.placeId,
    geopoint: place.geopoint,
    createdAt: new Date(),
  });

  return {
    travel: {
      fee,
      distanceKm,
      durationMin,
      clientCity: place.city,
      quotedAt: new Date(),
    },
    bookingId: bookingRef.id,
    privateAddressRef,
  };
}
