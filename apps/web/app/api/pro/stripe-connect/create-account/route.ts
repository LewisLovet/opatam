import { NextRequest, NextResponse } from 'next/server';
import { getStripeDev } from '@/lib/stripe';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/pro/stripe-connect/create-account
 *
 * Creates a Stripe Connect Express account for the authenticated provider
 * and returns an onboarding URL the pro must complete (KYC + IBAN).
 *
 * Idempotent: if the provider already has a `stripeConnectAccountId`, we
 * just regenerate a fresh onboarding link instead of creating a new account.
 *
 * Requires `Authorization: Bearer <Firebase ID token>` header. The decoded
 * uid must match an existing `providers/{uid}` document.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = getAdminFirestore();

    // FIXME(deposits-launch): remove this gate when depositsPublic flips to true.
    // See lib/feature-flags.ts for the full launch checklist.
    const userDoc = await db.collection('users').doc(uid).get();
    const isAdmin = userDoc.exists && userDoc.data()?.isAdmin === true;
    if (!canUseDepositsServer(isAdmin)) {
      return NextResponse.json(
        { error: 'Fonctionnalité réservée aux administrateurs pour le moment.' },
        { status: 403 }
      );
    }

    const providerRef = db.collection('providers').doc(uid);
    const providerSnap = await providerRef.get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }
    const provider = providerSnap.data()!;

    // Routes through STRIPE_SECRET_KEY_DEV (sk_test_...) when set in .env.local,
    // falls back to live STRIPE_SECRET_KEY otherwise. Lets us onboard test
    // connected accounts in dev without touching production data.
    const stripe = getStripeDev();

    // ── Get/Create Connect Express account ───────────────────────────────
    let accountId = provider.stripeConnectAccountId as string | null;

    // If we have an account ID, verify it actually exists in the current
    // Stripe environment. If we switched between test/live keys, the old
    // account ID can't be reached and we should fall back to creating a
    // fresh one rather than leaving the pro stuck.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('does not have access') || msg.includes('No such account')) {
          console.warn(
            `[create-account] account ${accountId} unreachable with current key — recreating`
          );
          accountId = null;
        } else {
          throw e;
        }
      }
    }

    if (!accountId) {
      // First time the pro starts onboarding — create the connected account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        // Email pre-fills the onboarding form. Pro can change it during onboarding.
        email: decoded.email ?? undefined,
        // Pro will charge clients (deposits) and receive payouts to their IBAN
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        // Versements HEBDOMADAIRES au lieu du quotidien par défaut.
        //
        // Stripe facture 0,10 € par virement vers le compte du prestataire, à
        // la charge de la plateforme. En quotidien, un pro qui encaisse tous
        // les jours génère une trentaine de virements par mois ; en
        // hebdomadaire, quatre. Sur juillet, 44 virements ont coûté 4,40 €
        // pour trois prestataires seulement.
        //
        // Le prestataire n'attend PAS plus longtemps : la cadence ne décide
        // que du REGROUPEMENT des paiements, pas de la date à laquelle les
        // fonds deviennent disponibles. C'est `delay_days` qui la fixe, et les
        // deux réglages sont indépendants.
        //
        // `delay_days: 'minimum'` applique le plancher du pays du compte —
        // 3 jours ouvrés en France — au lieu des 7 jours calendaires figés
        // ici auparavant. Écrire 7 en dur empêchait Stripe d'appliquer son
        // propre minimum, et donc de le raccourcir à mesure que l'historique
        // du prestataire se construit.
        //
        // Ancre au VENDREDI et non au lundi : avec un délai compté en jours
        // OUVRÉS, un versement le lundi rate systématiquement les
        // encaissements du mercredi au vendredi, qui doivent alors attendre
        // la semaine suivante. Rejoué sur les 279 paiements réels, l'attente
        // moyenne passe de 10,1 jours (lundi, délai 7) à 5,9 jours
        // (vendredi, délai minimum), pour le même nombre de virements.
        //
        // La cadence est décidée ICI, et nulle part ailleurs. Un compte Express
        // ne choisit PAS son intervalle : son tableau de bord ne propose que
        // « automatique ou manuel », et seulement si la plateforme a activé
        // cette fonctionnalité. C'est Opatam qui porte la responsabilité des
        // litiges (`losses.payments: 'application'`), donc c'est Opatam qui
        // règle le calendrier de versement.
        settings: {
          payouts: {
            schedule: { interval: 'weekly', weekly_anchor: 'friday', delay_days: 'minimum' },
          },
        },
        metadata: {
          providerId: uid,
          businessName: (provider.businessName as string) ?? '',
        },
      });
      accountId = account.id;

      await providerRef.update({
        stripeConnectAccountId: accountId,
        stripeConnectStatus: 'pending',
        stripeConnectChargesEnabled: false,
        stripeConnectPayoutsEnabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── Generate the onboarding link (one-shot, expires after a few minutes) ──
    const origin = request.headers.get('origin') ?? 'https://opatam.com';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/pro/paiements?connect=refresh`,
      return_url: `${origin}/pro/paiements?connect=return`,
      type: 'account_onboarding',
    });

    return NextResponse.json({
      accountId,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/stripe-connect/create-account] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
