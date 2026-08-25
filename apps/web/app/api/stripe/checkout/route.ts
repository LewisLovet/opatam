import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { offreParId } from '@/lib/sales-offres';

interface CheckoutRequest {
  priceId: string;
  providerId: string;
  plan?: string;
  trialDays?: number;
  successUrl?: string;
  cancelUrl?: string;
  // Referral code typed on the Abonnement page (for pros who did NOT enter a
  // code at signup). Validated server-side below.
  promoCode?: string;
}

export async function POST(request: NextRequest) {
  console.log('[STRIPE-CHECKOUT] ========== START ==========');

  try {
    const body: CheckoutRequest = await request.json();
    console.log('[STRIPE-CHECKOUT] Request body received:', {
      priceId: body.priceId,
      providerId: body.providerId,
      plan: body.plan ?? 'NOT PROVIDED',
      trialDays: body.trialDays ?? 'NOT PROVIDED',
    });

    const { priceId, providerId, plan: planClient, trialDays, successUrl, cancelUrl, promoCode } = body;

    // Validate required fields
    if (!priceId || !providerId) {
      console.log('[STRIPE-CHECKOUT] ERROR: Missing required fields');
      return NextResponse.json(
        { message: 'priceId and providerId are required' },
        { status: 400 }
      );
    }

    // ── AUTHENTIFICATION (audit P0) : cette route acceptait n'importe quel
    // providerId, prix et plan sans jeton — permettant d'abonner le compte
    // d'un tiers, de lui rattacher un affilié, ou de payer un plan au prix
    // d'un autre. Désormais : Bearer Firebase obligatoire, et l'appelant ne
    // paie QUE pour son propre compte (Provider.id === User.id). ──
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authentification requise' }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(authHeader.slice(7))).uid;
    } catch {
      return NextResponse.json({ message: 'Jeton invalide ou expiré' }, { status: 401 });
    }
    if (uid !== providerId) {
      return NextResponse.json(
        { message: 'Vous ne pouvez souscrire que pour votre propre compte' },
        { status: 403 }
      );
    }

    const stripe = getStripe();
    const db = getAdminFirestore();

    // ── PRIX ET PLAN CÔTÉ SERVEUR (audit P0) : le prix doit être un tarif
    // actif de NOTRE catalogue, et le plan se déduit du produit Stripe —
    // jamais du client (un priceId à 0 € avec plan « team » aurait activé
    // un abonnement équipe gratuit). ──
    let prixStripe: import('stripe').Stripe.Price;
    try {
      prixStripe = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    } catch {
      return NextResponse.json({ message: 'Tarif inconnu' }, { status: 400 });
    }
    const produit = prixStripe.product as import('stripe').Stripe.Product;
    const planServeur = (produit?.metadata?.plan ?? '').trim();
    if (!prixStripe.active || !prixStripe.recurring || produit?.deleted) {
      return NextResponse.json({ message: 'Tarif indisponible' }, { status: 400 });
    }
    const providerPourPlan = await db.collection('providers').doc(providerId).get();
    // Un compte Firebase client SANS espace prestataire ne souscrit rien
    // (audit) : la session Stripe créerait un abonnement orphelin.
    if (!providerPourPlan.exists) {
      return NextResponse.json({ message: 'Aucun espace prestataire pour ce compte' }, { status: 403 });
    }
    const estCompteTest = providerPourPlan.data()?.isTest === true;
    if (planServeur !== 'solo' && planServeur !== 'team' && !(planServeur === 'test' && estCompteTest)) {
      return NextResponse.json({ message: 'Tarif hors catalogue' }, { status: 400 });
    }
    // Liste blanche STRICTE, ACTIVE PAR DÉFAUT (audit, 2e passage) : le
    // catalogue Stripe contient d'ANCIENS prix actifs encore étiquetés
    // solo — Pro à 14,90 €/mois et 199→120 €/an — que metadata.plan
    // acceptait. Les quatre tarifs canoniques sont codés ici ;
    // STRIPE_ALLOWED_PRICE_IDS (ids séparés par des virgules) les remplace
    // si un tarif change sans redéploiement. Le plan « test » des comptes
    // isTest passe hors liste (outil de vérification du flux de paiement).
    const LISTE_BLANCHE_DEFAUT = [
      'price_1TAvgoRzY6soe6MNDShGM8Mn', // Pro mensuel 19,90 €
      'price_1TAvgoRzY6soe6MNquyaHVVp', // Pro annuel 199 €
      'price_1SyCVcRzY6soe6MN9ovoqJMX', // Studio mensuel 29,90 €
      'price_1TAvRYRzY6soe6MNfpTJUUzb', // Studio annuel 299 €
    ];
    const listeBlancheEnv = (process.env.STRIPE_ALLOWED_PRICE_IDS ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const listeBlanche = listeBlancheEnv.length > 0 ? listeBlancheEnv : LISTE_BLANCHE_DEFAUT;
    const estPlanTestAutorise = planServeur === 'test' && estCompteTest;
    if (!estPlanTestAutorise && !listeBlanche.includes(priceId)) {
      return NextResponse.json({ message: 'Tarif hors liste autorisée' }, { status: 400 });
    }
    const plan = planServeur;
    void planClient; // ignoré volontairement — le serveur fait foi

    // Les URLs de retour restent chez nous : chemins relatifs uniquement.
    const successUrlSur = typeof successUrl === 'string' && successUrl.startsWith('/') ? successUrl : '/pro/abonnement';
    const cancelUrlSur = typeof cancelUrl === 'string' && cancelUrl.startsWith('/') ? cancelUrl : '/pro/abonnement';

    // Check if provider has an affiliate code + capture the remaining
    // free-trial end so we can honor it (see trial_end below).
    let affiliateCode: string | null = null;
    let affiliateId: string | null = null;
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;
    let trialValidUntil: Date | null = null;

    try {
      const providerDoc = await db.collection('providers').doc(providerId).get();
      if (providerDoc.exists) {
        const providerData = providerDoc.data();
        affiliateCode = providerData?.affiliateCode || null;
        affiliateId = providerData?.affiliateId || null;
        trialValidUntil = providerData?.subscription?.validUntil?.toDate?.() ?? null;

        // If affiliate exists, get the coupon
        if (affiliateId) {
          const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
          if (affiliateDoc.exists) {
            stripeCouponId = affiliateDoc.data()?.stripeCouponId || null;
          }
        }
      }

      // A code typed on the Abonnement page (pro who didn't enter one at
      // signup). Resolve it server-side — never trust a client-passed id — and
      // let it take precedence so the discount applies. We persist the link on
      // the provider doc so the webhook attributes the commission on BOTH the
      // first payment (metadata) AND every recurring invoice (provider doc).
      const typedCode = promoCode?.toUpperCase().trim();
      let typedMatchedAffiliate = false;
      if (typedCode) {
        const affSnap = await db
          .collection('affiliates')
          .where('code', '==', typedCode)
          .where('isActive', '==', true)
          .limit(1)
          .get();
        if (!affSnap.empty) {
          typedMatchedAffiliate = true;
          const affDoc = affSnap.docs[0];
          const aff = affDoc.data();
          // Attribute the referral regardless of discount (commission still
          // applies); apply the coupon only when the affiliate has one.
          affiliateId = affDoc.id;
          affiliateCode = aff.code || typedCode;
          stripeCouponId = aff?.stripeCouponId || null;
          await db
            .collection('providers')
            .doc(providerId)
            .update({ affiliateCode, affiliateId, updatedAt: new Date() })
            .catch((e) => console.warn('[STRIPE-CHECKOUT] persist affiliate failed:', e));
        }
      }

      // Native Stripe promotion code (created directly in the Stripe dashboard,
      // not an affiliate). Only when the typed code isn't an affiliate code.
      // Takes precedence over any pre-existing affiliate coupon (it's what the
      // pro just typed). No commission is attributed for these.
      if (promoCode && !typedMatchedAffiliate) {
        const candidates = [...new Set([promoCode.trim(), promoCode.trim().toUpperCase()])];
        for (const c of candidates) {
          // active:true already filters out expired/maxed-out codes; Stripe
          // re-validates the promotion_code at checkout, so existence is enough.
          const promos = await stripe.promotionCodes.list({ code: c, active: true, limit: 1 });
          if (promos.data[0]) {
            // Offre commerciale « annuel seulement » : la restriction était un
            // texte d'interface (audit P1) — le serveur la fait respecter.
            const offreId = promos.data[0].metadata?.offerId;
            const offre = offreId ? offreParId(offreId) : null;
            if (offre?.annuelSeulement && prixStripe.recurring?.interval !== 'year') {
              return NextResponse.json(
                { message: `Le code ${c} est réservé à l'abonnement annuel.` },
                { status: 400 }
              );
            }
            stripePromotionCodeId = promos.data[0].id;
            break;
          }
        }
      }
    } catch (err) {
      console.warn('[STRIPE-CHECKOUT] Could not fetch affiliate info:', err);
    }

    const metadata = {
      providerId,
      ...(plan ? { plan } : {}),
      ...(affiliateCode ? { affiliateCode } : {}),
      ...(affiliateId ? { affiliateId } : {}),
    };

    // Trial handling: subscribing DURING the free trial must capture the
    // card now but charge only at the existing trial end (validUntil) —
    // the pro keeps their full free trial, no early charge.
    //   - explicit `trialDays` param wins (legacy/override),
    //   - else, if validUntil is far enough in the future (Stripe needs
    //     trial_end ≥ ~48h), charge exactly at validUntil,
    //   - else (trial over / almost over) → no trial, charge now.
    const nowSec = Math.floor(Date.now() / 1000);
    let trialEndUnix: number | null = null;
    if (trialValidUntil) {
      const vuSec = Math.floor(trialValidUntil.getTime() / 1000);
      if (vuSec > nowSec + 48 * 60 * 60) trialEndUnix = vuSec;
    }
    const subscriptionData: Record<string, unknown> = { metadata };
    // trialDays client : outil de test uniquement — un pro authentifié
    // pourrait sinon s'offrir un essai arbitraire (audit P0).
    if (typeof trialDays === 'number' && trialDays > 0 && estCompteTest) {
      subscriptionData.trial_period_days = trialDays;
    } else if (trialEndUnix) {
      subscriptionData.trial_end = trialEndUnix;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Codes are handled by our own validated field on the Abonnement page,
      // resolved server-side above and applied here via `discounts`:
      //   - affiliate code  → its coupon (+ commission attribution),
      //   - native Stripe promotion code → its promotion_code (no commission).
      // Stripe's native checkout promo field stays disabled when no code applies.
      allow_promotion_codes: stripeCouponId || stripePromotionCodeId ? undefined : false,
      ...(stripePromotionCodeId
        ? { discounts: [{ promotion_code: stripePromotionCodeId }] }
        : stripeCouponId
          ? { discounts: [{ coupon: stripeCouponId }] }
          : {}),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: subscriptionData as any,
      metadata,
      // Chemins RELATIFS validés plus haut — pas de redirection arbitraire.
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}${successUrlSur}${successUrlSur.includes('?') ? '&' : '?'}success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}${cancelUrlSur}${cancelUrlSur.includes('?') ? '&' : '?'}cancelled=true`,
    });

    console.log('[STRIPE-CHECKOUT] SUCCESS - Session created:', session.id);
    console.log('[STRIPE-CHECKOUT] ========== END ==========');
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[STRIPE-CHECKOUT] EXCEPTION:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
