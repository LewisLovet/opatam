import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import type { StripeEconomics, StripeTx } from '@/services/admin/types';

/**
 * Économie Stripe complète : ce qui entre, ce qui sort, et ce qui n'entre pas.
 *
 * POURQUOI UNE ROUTE À PART DE `?type=revenue` :
 * celle-là répond à « combien gagne-t-on » en lisant abonnements et factures.
 * Celle-ci répond à « combien paie-t-on », ce qui demande les transactions de
 * solde — seul endroit où figurent les frais Connect, qui n'apparaissent sur
 * aucune facture client. Autre pagination, autre coût, autre cache.
 *
 * TOUT EST EN LECTURE. Aucune écriture, aucun remboursement, aucun virement.
 */

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists && doc.data()?.isAdmin === true;
}

/** Montant mensuel BRUT d'une ligne d'abonnement, en centimes. */
function itemMonthlyCents(item: Stripe.SubscriptionItem): number {
  const price = item.price;
  if (!price?.unit_amount) return 0;
  const qty = item.quantity ?? 1;
  const count = price.recurring?.interval_count ?? 1;
  switch (price.recurring?.interval) {
    case 'year': return (price.unit_amount / 12 / count) * qty;
    case 'week': return ((price.unit_amount * 52) / 12 / count) * qty;
    case 'day': return ((price.unit_amount * 365) / 12 / count) * qty;
    default: return (price.unit_amount / count) * qty;
  }
}

/**
 * Le coupon actif sur un abonnement, s'il y en a un.
 *
 * Stripe a migré `discount` (singulier) vers `discounts` (tableau). Les deux
 * coexistent : lire seulement le nouveau rate les abonnements créés avant la
 * migration, lire seulement l'ancien rate les récents.
 */
function activeCoupon(sub: Stripe.Subscription): Stripe.Coupon | null {
  // Typé à la main : le SDK décrit `discounts` comme un tableau d'identifiants
  // OU d'objets étendus, et `discount` reste hors du type public. Un accès
  // structurel évite de dépendre d'une forme que la version du SDK peut
  // changer sous nos pieds.
  type PorteurDeCoupon = { coupon?: Stripe.Coupon | null };
  const brut = sub as unknown as {
    discounts?: unknown[];
    discount?: PorteurDeCoupon | null;
  };

  const premier = brut.discounts?.[0];
  if (premier && typeof premier === 'object' && 'coupon' in premier) {
    return (premier as PorteurDeCoupon).coupon ?? null;
  }
  return brut.discount?.coupon ?? null;
}

/** Applique la remise à un montant mensuel. Un coupon 100 % ramène à zéro. */
function applyCoupon(monthlyCents: number, coupon: Stripe.Coupon | null): number {
  if (!coupon) return monthlyCents;
  if (coupon.percent_off) return monthlyCents * (1 - coupon.percent_off / 100);
  if (coupon.amount_off) return Math.max(0, monthlyCents - coupon.amount_off);
  return monthlyCents;
}


/**
 * Le poste comptable d'une transaction, tel qu'on veut le lire.
 *
 * Stripe donne un `type` technique (charge, payment, transfer…) qui ne dit
 * pas si l'argent est à nous. Cette classification-ci répond à la seule
 * question utile : est-ce un revenu, de l'argent qui transite, ou un coût ?
 */
function classify(tx: Stripe.BalanceTransaction): StripeTx['category'] {
  const desc = tx.description ?? '';
  switch (tx.type) {
    case 'charge':
    case 'payment':
      return desc.includes('Acompte') ? 'acompte' : 'revenu';
    case 'refund':
    case 'payment_refund':
      return 'remboursement';
    case 'transfer':
    case 'transfer_refund':
      return 'reversement';
    case 'payout':
      return 'virement';
    // Fonds immobilisés par Stripe le temps qu'un compte connecté se
    // régularise. Ce n'est ni un revenu ni un frais : l'argent revient.
    // Sans cette catégorie, ces lignes tombaient dans « Autre » et
    // laissaient croire à un coût de plus.
    case 'reserve_transaction':
      return 'reserve';
    case 'stripe_fee':
      return desc.startsWith('Connect') ? 'frais-connect' : 'frais-billing';
    default:
      return 'autre';
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const stripe = getStripe();
    const db = getAdminFirestore();

    // ── Recettes ─────────────────────────────────────────────────────────
    //
    // RÈGLE : le MRR ne compte QUE les abonnements actifs, NET de remise.
    // Un essai n'est pas un revenu — il est calculé à part et jamais
    // additionné. Un coupon à 100 % ne rapporte rien et vaut zéro ici, même
    // si l'abonnement est bien « actif ».
    //
    // Ventilé par LIGNE et non par abonnement : un même abonnement porte le
    // plan ET le Pack sérénité. Se fier à `metadata.productType` — ce que
    // fait l'écran Revenus — attribue alors tout au plan, et les 5 € de
    // Sérénité disparaissent.
    const byProduct: Record<string, { label: string; subscribers: number; mrr: number }> = {};
    let mrrActive = 0;
    let pipelineTrials = 0;
    let mrrForfeitedToCoupons = 0;
    let activeCount = 0;
    let trialingCount = 0;
    let freeByCouponCount = 0;

    for await (const sub of stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.discounts'],
    })) {
      if (sub.status !== 'active' && sub.status !== 'trialing') continue;
      const coupon = activeCoupon(sub);
      const grossTotal = sub.items.data.reduce((s, i) => s + itemMonthlyCents(i), 0);
      const netTotal = applyCoupon(grossTotal, coupon);

      if (sub.status === 'trialing') {
        trialingCount++;
        pipelineTrials += Math.round(netTotal);
        continue; // JAMAIS additionné au MRR.
      }

      activeCount++;
      mrrForfeitedToCoupons += Math.round(grossTotal - netTotal);
      if (netTotal === 0) freeByCouponCount++;
      mrrActive += Math.round(netTotal);

      // La remise s'applique à l'abonnement entier : on la répartit au
      // prorata sur ses lignes, sinon la somme des produits ne retombe pas
      // sur le MRR affiché juste au-dessus.
      const ratio = grossTotal > 0 ? netTotal / grossTotal : 0;
      for (const item of sub.items.data) {
        const cents = Math.round(itemMonthlyCents(item) * ratio);
        const productId =
          typeof item.price.product === 'string' ? item.price.product : item.price.product?.id;
        const key = productId ?? 'inconnu';
        byProduct[key] = byProduct[key] ?? { label: key, subscribers: 0, mrr: 0 };
        byProduct[key].subscribers++;
        byProduct[key].mrr += cents;
      }
    }

    const products = await stripe.products.list({ limit: 100 });
    for (const p of products.data) if (byProduct[p.id]) byProduct[p.id].label = p.name;

    // ── Ce que Stripe prélève, mois par mois ─────────────────────────────
    const months: Record<string, {
      collected: number; processingFees: number; refunded: number;
      transferred: number; connectFees: number; billingFees: number;
    }> = {};
    const connectByKind: Record<string, number> = {};
    let depositVolume = 0;
    let depositProcessingFees = 0;
    let depositCount = 0;
    const transactions: StripeTx[] = [];

    for await (const tx of stripe.balanceTransactions.list({ limit: 100 })) {
      const month = new Date(tx.created * 1000).toISOString().slice(0, 7);
      months[month] = months[month] ?? {
        collected: 0, processingFees: 0, refunded: 0,
        transferred: 0, connectFees: 0, billingFees: 0,
      };
      const m = months[month];
      const isDeposit = (tx.description ?? '').includes('Acompte');

      // Chaque ligne est conservée telle quelle : c'est ce qui permet de
      // remonter d'un total à la transaction qui l'a produit. Le volume est
      // faible (une centaine), donc tout est envoyé d'un coup et filtré à
      // l'écran — un aller-retour par filtre serait plus lent et plus cher.
      transactions.push({
        id: tx.id,
        created: new Date(tx.created * 1000).toISOString(),
        type: tx.type,
        category: classify(tx),
        description: tx.description ?? null,
        amount: tx.amount,
        fee: tx.fee,
        net: tx.net,
      });

      switch (tx.type) {
        case 'charge':
        case 'payment':
          m.collected += tx.amount;
          m.processingFees += tx.fee;
          if (isDeposit) {
            depositVolume += tx.amount;
            depositProcessingFees += tx.fee;
            depositCount++;
          }
          break;
        case 'refund':
        case 'payment_refund':
          m.refunded += tx.amount;
          break;
        case 'transfer':
        case 'transfer_refund':
          m.transferred += tx.amount;
          break;
        case 'stripe_fee': {
          const desc = tx.description ?? '';
          if (desc.startsWith('Connect')) {
            m.connectFees += tx.amount;
            connectByKind[desc.split(': ')[1] ?? 'Autre'] =
              (connectByKind[desc.split(': ')[1] ?? 'Autre'] ?? 0) + tx.amount;
          } else {
            m.billingFees += tx.amount;
          }
          break;
        }
      }
    }

    let connected = 0;
    let chargesEnabled = 0;
    for await (const acc of stripe.accounts.list({ limit: 100 })) {
      connected++;
      if (acc.charges_enabled) chargesEnabled++;
    }

    // ── Ce qui N'ENTRE PAS ───────────────────────────────────────────────
    //
    // Lu dans Firestore et non chez Stripe : l'essai de l'application et
    // l'accès offert n'ont AUCUNE existence côté Stripe. Un essai expiré ne
    // laisse aucune trace là-bas, et un accès offert n'a jamais créé
    // d'abonnement. Ils sont donc invisibles de tout écran branché sur
    // Stripe seul — c'est exactement ce qui manquait.
    const providersSnap = await db.collection('providers').get();
    const now = Date.now();
    let realProviders = 0;
    let trialActive = 0;
    let trialExpiredNeverPaid = 0;
    let paying = 0;
    const compAccess: { name: string; plan: string; until: string | null }[] = [];

    for (const doc of providersSnap.docs) {
      const p = doc.data();
      if (p.isTest) continue;
      realProviders++;

      if (p.accessOverride) {
        compAccess.push({
          name: p.businessName ?? '(sans nom)',
          plan: p.accessOverride.plan ?? p.plan ?? '?',
          until: p.accessOverride.until?.toDate?.()?.toISOString() ?? null,
        });
      }

      const sub = p.subscription ?? {};
      const end = sub.validUntil?.toDate?.() ?? sub.currentPeriodEnd?.toDate?.() ?? null;
      if (sub.status === 'active') paying++;
      else if (sub.status === 'trialing') {
        if (end && end.getTime() < now) trialExpiredNeverPaid++;
        else trialActive++;
      }
    }

    const connectFeesTotal = Object.values(connectByKind).reduce((s, v) => s + v, 0);

    const payload: StripeEconomics = {
      mrrActive,
      pipelineTrials,
      mrrForfeitedToCoupons,
      activeCount,
      trialingCount,
      freeByCouponCount,
      byProduct: Object.values(byProduct).sort((a, b) => b.mrr - a.mrr),
      months: Object.entries(months)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v })),
      connectByKind: Object.entries(connectByKind)
        .map(([kind, amount]) => ({ kind, amount }))
        .sort((a, b) => a.amount - b.amount),
      deposits: {
        volume: depositVolume,
        count: depositCount,
        processingFees: depositProcessingFees,
        connectFees: connectFeesTotal,
        commission: 0,
      },
      accounts: { connected, chargesEnabled },
      transactions: transactions.sort((a, b) => b.created.localeCompare(a.created)),
      funnel: {
        realProviders,
        paying,
        trialActive,
        trialExpiredNeverPaid,
        compAccess: compAccess.sort((a, b) => a.name.localeCompare(b.name)),
      },
      generatedAt: new Date().toISOString(),
    };

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=1200');
    return res;
  } catch (error) {
    console.error('[admin/stripe]', error);
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 });
  }
}
