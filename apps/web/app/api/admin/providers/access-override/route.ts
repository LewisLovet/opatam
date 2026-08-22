import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendCompAccessGrantedEmail } from '@/lib/emails/compAccessGranted';
import { revalidateProviderPublicPages } from '@/lib/revalidate';

/**
 * Verifies the admin AND their personal action code (bcrypt `adminCodeHash`).
 * Granting/revoking free access is a critical action → always code-gated.
 */
async function verifyAdminWithCode(
  uid: string,
  code: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const db = getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.isAdmin !== true) return { ok: false, error: 'Non autorisé' };
  if (typeof code !== 'string' || !code) return { ok: false, error: 'Code admin requis' };
  if (!data?.adminCodeHash) {
    return { ok: false, error: 'Aucun code admin défini (configure-le via « Modifier le code »)' };
  }
  const ok = await bcrypt.compare(code, data.adminCodeHash);
  return ok ? { ok: true } : { ok: false, error: 'Code incorrect' };
}

/**
 * POST /api/admin/providers/access-override
 *
 * Grant or revoke a manual "comp" access (free access, no payment), stored in
 * `provider.accessOverride` — OUTSIDE the Stripe-synced `subscription` object,
 * so webhooks can never overwrite it. All access gates honour it.
 *
 * Body: { providerId, action: 'grant'|'revoke', plan?: 'solo'|'team',
 *         until?: ISO string|null (null = indefinite), reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const adminUid = request.headers.get('x-admin-uid');
    if (!adminUid) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { providerId, action, plan, until, reason, code, serenity } = body;
    if (!providerId || (action !== 'grant' && action !== 'revoke' && action !== 'set-serenity')) {
      return NextResponse.json({ error: 'providerId + action (grant|revoke|set-serenity) requis' }, { status: 400 });
    }

    // Critical action → require the admin's personal code.
    const auth = await verifyAdminWithCode(adminUid, code);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const db = getAdminFirestore();
    const ref = db.collection('providers').doc(providerId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }

    // Toggle Sérénité on an ALREADY-active comp, without touching the rest of
    // the grant — so an admin can add/remove the deposits add-on independently
    // (the two are dissociated).
    if (action === 'set-serenity') {
      const prev = snap.data()?.accessOverride;
      if (!prev?.active) {
        return NextResponse.json(
          { error: "Donne d'abord l'accès offert avant d'activer Sérénité." },
          { status: 400 },
        );
      }
      const enable = serenity === true;
      // On n'écrit QUE l'override : les gates lisent le comp directement
      // (computeEntitlements.canUseDeposits). Matérialiser
      // `depositsAddonActive` ici était ce qui faisait survivre l'acompte à
      // l'expiration du comp — le flag reste réservé aux paiements réels.
      await ref.update({
        'accessOverride.serenity': enable,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // When newly enabling, email the provider the Sérénité info (incl. the
      // "activate Stripe to get paid" step) — they may have been comped before
      // this feature existed and never received it. Best-effort.
      if (enable) {
        try {
          const providerData = snap.data()!;
          const ownerSnap = providerData.userId
            ? await db.collection('users').doc(providerData.userId).get()
            : null;
          const to = ownerSnap?.data()?.email as string | undefined;
          if (to) {
            const untilVal =
              prev.until?.toDate?.() ?? (prev.until ? new Date(prev.until) : null);
            await sendCompAccessGrantedEmail({
              to,
              businessName: providerData.businessName || 'votre établissement',
              plan: prev.plan === 'team' ? 'team' : 'solo',
              serenity: true,
              until: untilVal,
            });
          }
        } catch (emailErr) {
          console.error('[admin/access-override] set-serenity email failed (non-blocking):', emailErr);
        }
      }

      return NextResponse.json({ success: true, action: 'set-serenity', serenity: enable });
    }

    if (action === 'revoke') {
      const d = snap.data()!;
      const sub = d.subscription ?? {};
      const paidUnderneath =
        sub.status === 'active' ||
        sub.status === 'past_due' ||
        (sub.status === 'trialing' && !!(sub.stripeSubscriptionId || sub.revenuecatAppUserId));
      const realSerenity =
        d.serenity?.status === 'active' || d.serenity?.status === 'trialing';

      const revokeUpdate: Record<string, unknown> = {
        accessOverride: null,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Réconciliation de l'HÉRITAGE : l'ancien octroi mutait `plan` et
      // `depositsAddonActive` pour simuler le tier. On les ramène à ce que la
      // facturation réelle justifie, sinon un compte compé en `team` puis
      // révoqué garderait l'interface Studio à vie. Un abonnement payant
      // encore valide n'est évidemment pas touché.
      if (!paidUnderneath && d.plan !== 'trial') revokeUpdate.plan = 'trial';
      if (paidUnderneath && sub.plan && d.plan !== sub.plan) revokeUpdate.plan = sub.plan;
      if (d.depositsAddonActive === true && !realSerenity) {
        revokeUpdate.depositsAddonActive = false;
      }
      // Plus aucun droit derrière (ni payant, ni essai en cours) → la page
      // publique n'a plus de raison d'être servie.
      const trialStillRunning =
        sub.status === 'trialing' &&
        (sub.validUntil?.toDate?.()?.getTime() ?? 0) > Date.now();
      if (!paidUnderneath && !trialStillRunning && d.isPublished === true) {
        revokeUpdate.isPublished = false;
      }

      await ref.update(revokeUpdate);
      if (revokeUpdate.isPublished === false) {
        revalidateProviderPublicPages(d.slug as string | undefined);
      }
      return NextResponse.json({
        success: true,
        action: 'revoke',
        reconciled: Object.keys(revokeUpdate).filter((k) => k !== 'accessOverride' && k !== 'updatedAt'),
      });
    }

    // grant
    const grantPlan = plan === 'team' ? 'team' : 'solo';
    const untilDate = until ? new Date(until) : null;
    if (until && isNaN(untilDate!.getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 });
    }

    const grantSerenity = serenity === true;
    // L'octroi n'écrit QUE l'override. Ni `plan`, ni `depositsAddonActive` :
    // le tier et l'acompte sont calculés à la lecture (computeEntitlements),
    // donc l'expiration du comp rend les droits sous-jacents toute seule —
    // aucune écriture ne survit qu'il faudrait nettoyer.
    //
    // La republication est un CHOIX EXPLICITE de l'admin (`republish: true`),
    // plus un effet de bord : la page a pu être dépubliée par le prestataire
    // lui-même, et l'octroi n'a pas à défaire cette intention en silence.
    const republish = body.republish === true;
    await ref.update({
      accessOverride: {
        active: true,
        plan: grantPlan,
        until: untilDate ? Timestamp.fromDate(untilDate) : null,
        reason: reason || null,
        grantedBy: adminUid,
        grantedAt: Timestamp.now(),
        serenity: grantSerenity,
      },
      ...(republish ? { isPublished: true } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // La page vient de (re)gagner ses droits — dans TOUS les cas, purge du
    // cache public : même sans republication, isPubliclyVisible peut basculer
    // de faux à vrai pour une fiche restée isPublished mais privée de droits.
    revalidateProviderPublicPages(snap.data()?.slug as string | undefined);

    // Notify the provider with a branded email (best-effort, non-blocking).
    try {
      const providerData = snap.data()!;
      const ownerSnap = providerData.userId
        ? await db.collection('users').doc(providerData.userId).get()
        : null;
      const to = ownerSnap?.data()?.email as string | undefined;
      if (to) {
        await sendCompAccessGrantedEmail({
          to,
          businessName: providerData.businessName || 'votre établissement',
          plan: grantPlan,
          serenity: grantSerenity,
          until: untilDate,
        });
      } else {
        console.warn(`[admin/access-override] no owner email for ${providerId} — email skipped`);
      }
    } catch (emailErr) {
      console.error('[admin/access-override] email send failed (non-blocking):', emailErr);
    }

    return NextResponse.json({
      success: true,
      action: 'grant',
      plan: grantPlan,
      serenity: grantSerenity,
      until: untilDate?.toISOString() ?? null,
    });
  } catch (err: any) {
    console.error('[admin/access-override] error:', err);
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 });
  }
}
