import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Compte Stripe Connect du commercial — le circuit de sa rémunération.
 *
 * Les commerciaux sont des INDÉPENDANTS (décision direction 2026-08-26) :
 * la commission part en transfert Stripe vers leur compte Express, comme
 * pour les affiliés. Stripe porte le KYC, l'IBAN et les versements.
 *
 * POST — crée le compte Express s'il n'existe pas, renvoie un lien
 *   d'onboarding (KYC + IBAN, formulaire Stripe).
 * GET — synchronise le statut depuis Stripe (idempotent) et renvoie le
 *   total des commissions versées.
 *
 * Un admin sans fiche staffMembers n'est pas commissionné : refus clair.
 */

function statutDepuisCompte(account: {
  details_submitted?: boolean;
  payouts_enabled?: boolean;
}): 'active' | 'pending' | 'restricted' {
  if (account.payouts_enabled) return 'active';
  return account.details_submitted ? 'restricted' : 'pending';
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  const staffRef = db.collection('staffMembers').doc(auth.identity.uid);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    return NextResponse.json(
      { error: 'Réservé aux commerciaux — votre compte n’a pas de fiche équipe.' },
      { status: 400 },
    );
  }
  const staff = staffSnap.data()!;
  const stripe = getStripe();

  let accountId: string | null = staff.stripeAccountId ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: staff.email ?? undefined,
      // Reçoit des transferts (commissions), n'encaisse jamais de cartes.
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
      metadata: { role: 'sales', staffUid: auth.identity.uid },
    });
    accountId = account.id;
    await staffRef.update({
      stripeAccountId: accountId,
      stripeAccountStatus: 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const lien = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/sales?connect=reprendre`,
    return_url: `${baseUrl}/sales?connect=retour`,
    type: 'account_onboarding',
  });
  return NextResponse.json({ url: lien.url });
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  const staffRef = db.collection('staffMembers').doc(auth.identity.uid);
  const staffSnap = await staffRef.get();
  const staff = staffSnap.data();

  let statut: 'aucun' | 'active' | 'pending' | 'restricted' = 'aucun';
  if (staff?.stripeAccountId) {
    try {
      const account = await getStripe().accounts.retrieve(staff.stripeAccountId);
      statut = statutDepuisCompte(account);
      if (statut !== staff.stripeAccountStatus) {
        await staffRef.update({ stripeAccountStatus: statut });
      }
    } catch (e) {
      console.warn('[sales/connect] statut Stripe illisible:', e);
      statut = staff.stripeAccountStatus ?? 'pending';
    }
  }

  // Total réellement viré — la somme des commissions transférées.
  const commissionsSnap = await db
    .collection('salesCommissions')
    .where('staffUid', '==', auth.identity.uid)
    .limit(1000)
    .get();
  let totalVerseCents = 0;
  let enAttenteCents = 0;
  commissionsSnap.docs.forEach((d) => {
    const x = d.data();
    if (x.transferId) totalVerseCents += x.commissionCents ?? 0;
    else enAttenteCents += x.commissionCents ?? 0;
  });

  return NextResponse.json({
    statut,
    aUneFiche: staffSnap.exists,
    totalVerseCents,
    enAttenteCents,
    nbVersements: commissionsSnap.docs.filter((d) => d.data().transferId).length,
  });
}
