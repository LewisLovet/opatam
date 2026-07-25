/**
 * POST /api/loyalty/activate — le client active sa carte de fidélité chez
 * un prestataire (fidélité v2 : bouton + cinématique côté app).
 *
 * Auth : Bearer Firebase (client). La clé client est dérivée de l'email
 * VÉRIFIÉ du token (même canon email-first que getClientKey) — personne
 * ne peut activer la carte d'un autre.
 *
 * Effets : loyaltyActivatedAt (idempotent — jamais écrasé s'il existe),
 * promoEmailsOptIn (toujours mis à jour : sert aussi à se désinscrire).
 * Rétroactif par design : le compteur calculé existant s'applique tel quel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

const bodySchema = z.object({
  providerId: z.string().min(1),
  promoEmailsOptIn: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    let uid: string;
    let email: string | null;
    let name: string | null;
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
      uid = decoded.uid;
      email = decoded.email?.toLowerCase().trim() ?? null;
      name = (decoded.name as string | undefined) ?? null;
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const { providerId, promoEmailsOptIn } = parsed.data;

    // Clé canon email-first (miroir getClientKey) — l'email vient du token,
    // donc vérifié par Firebase.
    const clientKey = email ? `email:${email}` : `id:${uid}`;

    const db = getAdminFirestore();
    const ref = db.collection('providerClients').doc(`${providerId}_${clientKey}`);
    const activatedAt = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? snap.data()! : null;
      const already = existing?.loyaltyActivatedAt ?? null;
      if (existing) {
        tx.update(ref, {
          ...(already ? {} : { loyaltyActivatedAt: new Date() }),
          promoEmailsOptIn,
          ...(existing.clientId ? {} : { clientId: uid }),
          updatedAt: new Date(),
        });
      } else {
        // Client sans aucune résa chez ce pro : doc minimal — le prochain
        // recompute (déclenché par sa 1ʳᵉ résa) complètera identité et
        // compteurs en PRÉSERVANT ces champs.
        tx.set(ref, {
          providerId,
          clientKey,
          email,
          phone: null,
          name: name ?? email?.split('@')[0] ?? '',
          clientId: uid,
          photoURL: null,
          bookingsCount: 0,
          confirmedCount: 0,
          cancelledCount: 0,
          noshowCount: 0,
          loyaltyConfirmedCount: 0,
          totalRevenue: 0,
          firstBookingAt: new Date(),
          lastBookingAt: new Date(),
          tags: [],
          notes: null,
          preferences: null,
          marketingOptIn: false,
          marketingOptInAt: null,
          marketingOptOutAt: null,
          loyaltyActivatedAt: new Date(),
          promoEmailsOptIn,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return already ?? new Date();
    });

    return NextResponse.json({ success: true, activatedAt });
  } catch (e) {
    console.error('[loyalty/activate] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
