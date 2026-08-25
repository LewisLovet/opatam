import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  OFFRES_CATALOGUE,
  OFFRES_VALIDITE_JOURS,
  couponIdPourOffre,
  offreParId,
} from '@/lib/sales-offres';
import { signSalesLink } from '@/lib/sales-attribution';
import { generateSalesOffreEmail } from '@/lib/emails/salesOffre';

/**
 * Offres commerciales — génération de codes uniques et traçabilité.
 *
 * POST { offerId, leadId?, email?, message? } — génère un Promotion Code
 *   Stripe à usage unique (14 jours), le trace dans salesOffers/{code},
 *   journalise sur la fiche prospect, et envoie l'e-mail si `email`.
 *   → { code, url, expiresAt }
 * GET — le catalogue (avec l'état actif/désactivé) + les codes générés
 *   (les siens ; manager/admin : tous).
 * PATCH { desactivees: string[] } — l'admin active/désactive des offres.
 */

function genererCode(): string {
  // Lisible au téléphone : pas de 0/O ni 1/I.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `OPA-${s}`;
}

async function offresDesactivees(db: FirebaseFirestore.Firestore): Promise<string[]> {
  const snap = await db.collection('salesConfig').doc('offres').get();
  const d = snap.data()?.desactivees;
  return Array.isArray(d) ? d : [];
}

export async function GET(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const db = getAdminFirestore();
  const [desactivees, codesSnap] = await Promise.all([
    offresDesactivees(db),
    auth.identity.role === 'sales'
      ? db.collection('salesOffers').where('staffUid', '==', auth.identity.uid).limit(300).get()
      : db.collection('salesOffers').limit(300).get(),
  ]);

  return NextResponse.json({
    catalogue: OFFRES_CATALOGUE.map((o) => ({
      id: o.id,
      label: o.label,
      pitch: o.pitch,
      annuelSeulement: o.annuelSeulement === true,
      active: !desactivees.includes(o.id),
    })),
    codes: codesSnap.docs
      .map((d) => {
        const x = d.data();
        return {
          code: d.id,
          offerId: x.offerId,
          staffUid: x.staffUid,
          leadId: x.leadId ?? null,
          email: x.email ?? null,
          claimedByProviderId: x.claimedByProviderId ?? null,
          createdAt: x.createdAt?.toDate?.()?.toISOString() ?? null,
          expiresAt: x.expiresAt?.toDate?.()?.toISOString() ?? null,
          expired: (x.expiresAt?.toDate?.()?.getTime() ?? 0) < Date.now(),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { offerId, leadId, email, message, compteExistant } = await request.json().catch(() => ({}));
  const offre = typeof offerId === 'string' ? offreParId(offerId) : null;
  if (!offre) return NextResponse.json({ error: 'Offre inconnue' }, { status: 400 });

  const db = getAdminFirestore();

  // Une offre sans fiche commerciale active est de l'argent sans
  // responsable (audit P1) : le code porterait un staffUid que la
  // revendication refuserait — prospect payé, commission perdue. Même
  // règle que les liens d'attribution.
  const ficheOffre = await db.collection('staffMembers').doc(auth.identity.uid).get();
  if (!ficheOffre.exists || ficheOffre.data()?.active !== true) {
    return NextResponse.json(
      {
        error:
          'Les offres sont réservées aux fiches commerciales actives — votre compte n’en a pas. Invitez-vous depuis l’onglet Équipe pour tester.',
      },
      { status: 403 },
    );
  }
  if ((await offresDesactivees(db)).includes(offre.id)) {
    return NextResponse.json({ error: 'Cette offre est désactivée par la direction' }, { status: 400 });
  }
  const cleanEmail =
    typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
      ? email.trim().toLowerCase()
      : null;

  const stripe = getStripe();

  // Le coupon de l'offre — créé une fois pour toutes, id déterministe.
  const couponId = couponIdPourOffre(offre.id);
  try {
    await stripe.coupons.retrieve(couponId);
  } catch {
    await stripe.coupons.create({
      id: couponId,
      name: `Offre commerciale — ${offre.label}`,
      percent_off: offre.coupon.percentOff,
      duration: offre.coupon.duration,
      ...(offre.coupon.durationInMonths ? { duration_in_months: offre.coupon.durationInMonths } : {}),
    });
  }

  // Le code unique : Stripe fait respecter l'usage unique et l'expiration.
  const expiresAt = new Date(Date.now() + OFFRES_VALIDITE_JOURS * 86_400_000);
  let code = genererCode();
  let promotion: { id: string } | null = null;
  for (let essai = 0; essai < 3 && !promotion; essai++) {
    try {
      promotion = await stripe.promotionCodes.create({
        promotion: { type: 'coupon', coupon: couponId },
        code,
        max_redemptions: 1,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        metadata: { staffUid: auth.identity.uid, offerId: offre.id, ...(leadId ? { leadId } : {}) },
      });
    } catch {
      code = genererCode(); // collision de code : on retire
    }
  }
  if (!promotion) {
    return NextResponse.json({ error: 'Génération du code impossible (Stripe)' }, { status: 502 });
  }

  // Traçabilité — la contrepartie de la génération libre. En PAIEMENT
  // DIRECT (compte existant), le code est RÉSERVÉ à ce compte dès sa
  // naissance (audit P2) : claimedByProviderId = le compte lié de la
  // fiche — l'interface le montre servi, et le checkout refusera tout
  // autre compte.
  let providerReserve: string | null = null;
  if (compteExistant === true && typeof leadId === 'string' && leadId) {
    const leadPourReserve = await db.collection('salesLeads').doc(leadId).get();
    providerReserve = (leadPourReserve.data()?.linkedProviderId as string) ?? null;
  }
  await db.collection('salesOffers').doc(code).set({
    offerId: offre.id,
    staffUid: auth.identity.uid,
    leadId: typeof leadId === 'string' ? leadId : null,
    email: cleanEmail,
    stripePromotionCodeId: promotion.id,
    claimedByProviderId: providerReserve,
    ...(providerReserve ? { claimedAt: FieldValue.serverTimestamp() } : {}),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  // Le lien dépend de l'audience (décision client, anti-IAP) :
  //  - compte EXISTANT (prospect déjà inscrit, en essai) → directement la
  //    page de PAIEMENT web avec le code pré-appliqué — payer en ligne avant
  //    la fin de l'essai, sans passer par les achats intégrés des stores ;
  //  - prospect SANS compte → inscription, attribution signée + code.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
  const paiementDirect = compteExistant === true;
  let url = paiementDirect
    ? `${baseUrl}/pro/abonnement?offre=${encodeURIComponent(code)}`
    : `${baseUrl}/register?offre=${encodeURIComponent(code)}`;
  if (!paiementDirect) {
    try {
      const token = signSalesLink({ staffUid: auth.identity.uid, campaign: `offre-${offre.id}`, sector: null });
      url = `${baseUrl}/register?offre=${encodeURIComponent(code)}&s=${encodeURIComponent(token)}`;
    } catch (e) {
      console.warn('[sales/offres] signature du lien impossible (lien sans attribution):', e);
    }
  }

  // Journal sur la fiche prospect (best-effort).
  if (typeof leadId === 'string' && leadId) {
    try {
      const leadSnap = await db.collection('salesLeads').doc(leadId).get();
      if (leadSnap.exists && (auth.identity.role !== 'sales' || leadSnap.data()?.ownerUid === auth.identity.uid)) {
        await db.collection('salesActivities').add({
          leadId,
          authorUid: auth.identity.uid,
          type: 'email',
          stage: null,
          body: `Offre proposée : ${offre.label} (code ${code}, valable jusqu'au ${expiresAt.toLocaleDateString('fr-FR')})`,
          createdAt: FieldValue.serverTimestamp(),
        });
        await leadSnap.ref.update({
          lastInteractionAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('[sales/offres] journal prospect échoué:', e);
    }
  }

  // L'e-mail au prospect — le canal principal (décision client).
  let emailEnvoye = false;
  if (cleanEmail) {
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const staffSnap = await db.collection('staffMembers').doc(auth.identity.uid).get();
        const { subject, html } = generateSalesOffreEmail({
          offreLabel: offre.label,
          pitch: offre.pitch,
          annuelSeulement: offre.annuelSeulement === true,
          code,
          url,
          expiresLe: expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
          fromName: staffSnap.data()?.displayName ?? null,
          message: typeof message === 'string' ? message.slice(0, 600) : null,
          paiementDirect,
        });
        const { Resend } = await import('resend');
        await new Resend(resendApiKey).emails.send({
          from: 'Opatam <noreply@kamerleontech.com>',
          to: cleanEmail,
          subject,
          html,
        });
        emailEnvoye = true;
      }
    } catch (e) {
      console.warn('[sales/offres] e-mail échoué (le code reste valable):', e);
    }
  }

  return NextResponse.json({
    code,
    url,
    expiresAt: expiresAt.toISOString(),
    emailEnvoye,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  // Activer/désactiver une offre = politique de remise : ADMIN uniquement.
  if (auth.identity.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
  }
  const { desactivees } = await request.json().catch(() => ({}));
  if (!Array.isArray(desactivees) || desactivees.some((d) => typeof d !== 'string')) {
    return NextResponse.json({ error: 'desactivees: string[] requis' }, { status: 400 });
  }
  await getAdminFirestore()
    .collection('salesConfig')
    .doc('offres')
    .set({ desactivees, updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.identity.uid });
  return NextResponse.json({ success: true, desactivees });
}
