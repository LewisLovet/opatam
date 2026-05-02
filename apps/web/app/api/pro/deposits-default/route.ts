import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { canUseDepositsServer } from '@/lib/feature-flags';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

/**
 * PUT /api/pro/deposits-default
 *
 * Updates `provider.settings.depositDefault` — the percentage applied to
 * every service that doesn't have its own deposit override.
 *
 * Body:
 *   { percent: number, refundDeadlineHours: number }   to enable / update
 *   { percent: null }                                   to disable
 *
 * Pre-flight:
 *   - Auth via Firebase ID token (Bearer)
 *   - admin gate (FIXME(deposits-launch))
 *   - provider must have the deposits add-on active
 */

const bodySchema = z
  .object({
    percent: z
      .number()
      .int({ message: 'Le pourcentage doit être un entier' })
      .min(1, { message: "L'acompte doit être d'au moins 1 %" })
      .max(100, { message: "L'acompte ne peut pas dépasser 100 %" })
      .nullable(),
    refundDeadlineHours: z
      .number()
      .int()
      .min(0, { message: 'Le délai doit être positif' })
      .max(720, { message: 'Le délai ne peut pas dépasser 720 heures (30 jours)' })
      .default(24)
      .optional(),
  });

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = getAdminFirestore();

    // FIXME(deposits-launch): remove this gate when depositsPublic flips to true.
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

    if (!provider.depositsAddonActive) {
      return NextResponse.json(
        {
          error:
            "Activez l'add-on Acomptes avant de configurer un acompte par défaut.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = bodySchema.parse(body);

    // Disabling the default → write null.
    if (validated.percent === null) {
      await providerRef.update({
        'settings.depositDefault': null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, depositDefault: null });
    }

    // Enabling / updating the default
    const depositDefault = {
      percent: validated.percent,
      refundDeadlineHours: validated.refundDeadlineHours ?? 24,
    };

    await providerRef.update({
      'settings.depositDefault': depositDefault,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, depositDefault });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return NextResponse.json(
        { error: `${issue.path.join('.')} — ${issue.message}` },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : String(error ?? 'unknown');
    process.stderr.write(`[PRO/deposits-default] ${message}\n`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
