import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import type { StripeEconomics } from '@/services/admin/types';

/**
 * Économie Stripe complète : ce qui entre, ce qui sort, et ce que ça coûte.
 *
 * POURQUOI UNE ROUTE À PART DE `?type=revenue` :
 * celle-ci répond à « combien gagne-t-on », en lisant les abonnements et les
 * factures. Celle-ci répond à « combien paie-t-on », ce qui demande les
 * transactions de solde — une autre pagination, un autre coût d'appel, et un
 * cache plus long. Les mélanger aurait ralenti l'écran de revenus pour une
 * donnée qu'il n'affiche pas.
 *
 * TOUT EST EN LECTURE. Aucune écriture, aucun remboursement, aucun virement.
 */

async function verifyAdmin(uid: string) {
  const db = getAdminFirestore();
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists && doc.data()?.isAdmin === true;
}

/** Montant mensuel normalisé d'une ligne d'abonnement, en centimes. */
function itemMonthlyCents(item: Stripe.SubscriptionItem): number {
  const price = item.price;
  if (!price?.unit_amount) return 0;
  const qty = item.quantity ?? 1;
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count ?? 1;
  const monthly =
    interval === 'year' ? price.unit_amount / 12 / count
    : interval === 'week' ? (price.unit_amount * 52) / 12 / count
    : interval === 'day' ? (price.unit_amount * 365) / 12 / count
    : price.unit_amount / count;
  return monthly * qty;
}

export async function GET(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await verifyAdmin(adminUid)))
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });

    const stripe = getStripe();

    // ── Recettes récurrentes, ventilées par PRODUIT ──────────────────────
    //
    // Ventilé par ligne et non par abonnement : un même abonnement peut
    // porter le plan ET le Pack sérénité. Se fier à `metadata.productType`
    // de l'abonnement — ce que fait l'écran Revenus — attribue alors la
    // totalité au plan, et les 5 € de Sérénité disparaissent du décompte.
    //
    // `status: 'all'` puis filtre : `list({status:'active'})` EXCLUT les
    // essais, alors qu'un essai en cours est du revenu à venir qu'on veut voir.
    const byProduct: Record<string, { label: string; subscribers: number; mrr: number }> = {};
    let mrrActive = 0;
    let mrrTrialing = 0;
    let activeCount = 0;
    let trialingCount = 0;

    for await (const sub of stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.items.data.price'],
    })) {
      if (sub.status !== 'active' && sub.status !== 'trialing') continue;
      if (sub.status === 'active') activeCount++;
      else trialingCount++;

      for (const item of sub.items.data) {
        const cents = Math.round(itemMonthlyCents(item));
        if (!cents) continue;
        const productId =
          typeof item.price.product === 'string' ? item.price.product : item.price.product?.id;
        const key = productId ?? 'inconnu';
        byProduct[key] = byProduct[key] ?? { label: key, subscribers: 0, mrr: 0 };
        byProduct[key].subscribers++;
        byProduct[key].mrr += cents;
        if (sub.status === 'active') mrrActive += cents;
        else mrrTrialing += cents;
      }
    }

    // Les noms lisibles, en un appel plutôt qu'un par abonnement.
    const products = await stripe.products.list({ limit: 100 });
    for (const p of products.data) if (byProduct[p.id]) byProduct[p.id].label = p.name;

    // ── Ce que Stripe prélève, et pour quoi ──────────────────────────────
    //
    // Les transactions de solde sont la seule source qui montre TOUT :
    // les frais par paiement, mais aussi les frais Connect facturés
    // mensuellement, qui n'apparaissent sur aucune facture client.
    const months: Record<string, {
      collected: number; processingFees: number; refunded: number;
      transferred: number; connectFees: number; billingFees: number;
    }> = {};
    const connectByKind: Record<string, number> = {};
    let depositVolume = 0;
    let depositProcessingFees = 0;
    let depositCount = 0;

    for await (const tx of stripe.balanceTransactions.list({ limit: 100 })) {
      const month = new Date(tx.created * 1000).toISOString().slice(0, 7);
      months[month] = months[month] ?? {
        collected: 0, processingFees: 0, refunded: 0,
        transferred: 0, connectFees: 0, billingFees: 0,
      };
      const m = months[month];
      const isDeposit = (tx.description ?? '').includes('Acompte');

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
            // « Connect (2026-07-01 - 2026-07-31): Payout Fee » → « Payout Fee »
            const kind = desc.split(': ')[1] ?? 'Autre';
            connectByKind[kind] = (connectByKind[kind] ?? 0) + tx.amount;
          } else {
            m.billingFees += tx.amount;
          }
          break;
        }
      }
    }

    // ── Comptes connectés : le poste qui grossit tout seul ───────────────
    //
    // Stripe facture un abonnement mensuel par compte ACTIF (qui a eu de
    // l'activité), pas par compte connecté. Le nombre de comptes reliés est
    // donc un coût futur, pas un coût actuel — c'est ce que la projection
    // rend visible.
    let connected = 0;
    let chargesEnabled = 0;
    for await (const acc of stripe.accounts.list({ limit: 100 })) {
      connected++;
      if (acc.charges_enabled) chargesEnabled++;
    }

    const connectFeesTotal = Object.values(connectByKind).reduce((s, v) => s + v, 0);

    const payload: StripeEconomics = {
      mrrActive,
      mrrTrialing,
      activeCount,
      trialingCount,
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
        // Aucune commission n'est prélevée aujourd'hui : le champ existe pour
        // que le jour où elle le sera, l'écran le montre sans nouveau calcul.
        commission: 0,
      },
      accounts: { connected, chargesEnabled },
      generatedAt: new Date().toISOString(),
    };

    const res = NextResponse.json(payload);
    // Dix minutes : ces chiffres bougent à l'échelle de la journée, et
    // l'appel coûte plusieurs pages d'API Stripe.
    res.headers.set('Cache-Control', 'private, max-age=600, stale-while-revalidate=1200');
    return res;
  } catch (error) {
    console.error('[admin/stripe]', error);
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 });
  }
}
