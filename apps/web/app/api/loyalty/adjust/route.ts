/**
 * POST /api/loyalty/adjust — le pro ajoute/retire des points de fidélité
 * à un client (fidélité v2).
 *
 * Auth : Bearer Firebase — l'uid vérifié DOIT être le providerId (un pro
 * n'ajuste que ses propres clients). Gates : programme valide + accès
 * fidélité (plan payant ou carte enregistrée).
 *
 * Écrit en transaction sur providerClients/{providerId}_{clientKey} :
 *   loyaltyAdjustment += delta, journal (50 entrées max), updatedAt.
 * Puis email « bel email » au client (best-effort, locale mémorisée).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import {
  LOYALTY_ADJUSTMENT_REASONS,
  isLoyaltyConfigValid,
  hasLoyaltyAccess,
  effectiveLoyaltyCount,
} from '@booking-app/shared';
import { sendLoyaltyAdjustmentEmail } from '@/lib/emails/loyaltyAdjustment';

const bodySchema = z
  .object({
    clientKey: z.string().min(1).max(200),
    delta: z.number().int().min(-50).max(50).refine((d) => d !== 0, 'delta nul'),
    reason: z.enum(LOYALTY_ADJUSTMENT_REASONS),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((b) => b.reason !== 'autre' || (b.note && b.note.length > 0), {
    message: 'La justification libre est requise pour « autre »',
  });

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    let providerId: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
      providerId = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Requête invalide' },
        { status: 400 },
      );
    }
    const { clientKey, delta, reason } = parsed.data;
    const note = parsed.data.note ?? null;

    const db = getAdminFirestore();
    const providerSnap = await db.collection('providers').doc(providerId).get();
    if (!providerSnap.exists) {
      return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
    }
    const provider = providerSnap.data()!;
    const loyalty = provider.settings?.loyalty;
    if (!isLoyaltyConfigValid(loyalty) || !hasLoyaltyAccess(provider as never)) {
      return NextResponse.json({ error: 'Programme de fidélité inactif' }, { status: 403 });
    }

    const ref = db.collection('providerClients').doc(`${providerId}_${clientKey}`);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const data = snap.data()!;
      const newAdjustment = ((data.loyaltyAdjustment as number | undefined) ?? 0) + delta;
      const entry = { at: new Date(), delta, reason, note };
      const log = [entry, ...((data.loyaltyAdjustmentLog as unknown[] | undefined) ?? [])].slice(0, 50);
      tx.update(ref, {
        loyaltyAdjustment: newAdjustment,
        loyaltyAdjustmentLog: log,
        updatedAt: new Date(),
      });
      return {
        email: (data.email as string | null) ?? null,
        name: (data.name as string | undefined) ?? '',
        locale: (data.clientLocale as string | null) ?? null,
        newCount: effectiveLoyaltyCount((data.loyaltyConfirmedCount as number | undefined) ?? 0, newAdjustment),
        newAdjustment,
      };
    });
    if (!result) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });
    }

    // Email au client — best-effort, jamais bloquant.
    if (result.email) {
      sendLoyaltyAdjustmentEmail({
        to: result.email,
        clientName: result.name || result.email.split('@')[0],
        providerName: (provider.businessName as string) ?? 'Votre prestataire',
        delta,
        reason,
        note,
        newCount: result.newCount,
        threshold: loyalty!.threshold,
        locale: result.locale,
      }).catch((e) => console.error('[loyalty/adjust] email failed:', e));
    }

    return NextResponse.json({
      success: true,
      effectiveCount: result.newCount,
      adjustment: result.newAdjustment,
    });
  } catch (e) {
    console.error('[loyalty/adjust] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
