/**
 * POST /api/loyalty/activate — le client active sa carte de fidélité chez
 * un prestataire (fidélité v2 : bouton + cinématique côté app).
 *
 * Auth : Bearer Firebase (client).
 *
 * IDENTITÉ. La carte est identifiée par (`clientId` du token, `providerId`),
 * jamais par une clé envoyée par l'appelant ni par le seul email du compte
 * — voir `lib/loyalty-identity`. C'est ce qui garantit qu'on active LA carte
 * que le client voit dans `/api/loyalty/me`, et non une fiche fantôme créée
 * sous son email de compte pendant que ses réservations en alimentaient une
 * autre sous l'email du formulaire.
 *
 * Sans fiche existante (client qui n'a jamais réservé ici), on crée la
 * fiche au canon email-first, comme le fera le trigger à sa première résa.
 * Si une fiche orpheline existe déjà à cette clé — créée par une résa
 * saisie par le pro, sans compte —, on ne l'adopte QUE si l'email du token
 * est vérifié : `verifyIdToken()` atteste l'identité du compte, pas la
 * possession de l'adresse, et l'adopter à l'aveugle offrirait l'historique
 * d'un vrai client à qui s'inscrit avec son adresse.
 *
 * Effets : loyaltyActivatedAt (idempotent — jamais écrasé s'il existe),
 * promoEmailsOptIn (toujours mis à jour : sert aussi à se désinscrire).
 * Rétroactif par design : le compteur calculé existant s'applique tel quel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { resolveLoyaltyCard } from '@/lib/loyalty-identity';

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
    let emailVerified: boolean;
    let name: string | null;
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
      uid = decoded.uid;
      email = decoded.email?.toLowerCase().trim() ?? null;
      emailVerified = decoded.email_verified === true;
      name = (decoded.name as string | undefined) ?? null;
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    const { providerId, promoEmailsOptIn } = parsed.data;

    const db = getAdminFirestore();

    // 1. La carte unique de ce client chez ce pro. Si plusieurs fiches
    //    existent (réservations sous deux adresses), l'activation se pose
    //    sur la fiche PRINCIPALE — choix déterministe, donc deux appels
    //    concurrents visent le même document.
    const card = await resolveLoyaltyCard(db, providerId, uid);
    let ref = card.primary?.ref ?? null;

    // 2. Aucune fiche à son nom : on retombe sur le canon email-first, la
    //    clé que produira le trigger à sa première réservation.
    if (!ref) {
      const clientKey = email ? `email:${email}` : `id:${uid}`;
      const candidate = db.collection('providerClients').doc(`${providerId}_${clientKey}`);
      const snap = await candidate.get();
      if (snap.exists) {
        const ownerUid = snap.data()!.clientId as string | undefined;
        if (ownerUid && ownerUid !== uid) {
          // Ne devrait pas arriver (l'étape 1 aurait trouvé la fiche), mais
          // on refuse plutôt que d'écrire sur la fiche d'un autre compte.
          return NextResponse.json({ error: 'Fiche non autorisée' }, { status: 403 });
        }
        if (!ownerUid && !emailVerified) {
          return NextResponse.json(
            { error: 'Adresse email non vérifiée', code: 'email-not-verified' },
            { status: 403 },
          );
        }
      }
      ref = candidate;
    }

    const targetRef = ref;
    const activatedAt = await db.runTransaction(async (tx) => {
      const snap = await tx.get(targetRef);
      const existing = snap.exists ? snap.data()! : null;
      const already = existing?.loyaltyActivatedAt ?? null;
      if (existing) {
        // Relecture transactionnelle du propriétaire : la fiche a pu être
        // rattachée à un autre compte entre la résolution et ici.
        const ownerUid = existing.clientId as string | undefined;
        if (ownerUid && ownerUid !== uid) throw new Error('forbidden');
        tx.update(targetRef, {
          ...(already ? {} : { loyaltyActivatedAt: new Date() }),
          promoEmailsOptIn,
          ...(ownerUid ? {} : { clientId: uid }),
          updatedAt: new Date(),
        });
      } else {
        // Client sans aucune résa chez ce pro : doc minimal — le prochain
        // recompute (déclenché par sa 1ʳᵉ résa) complètera identité et
        // compteurs en PRÉSERVANT ces champs.
        tx.set(targetRef, {
          providerId,
          clientKey: email ? `email:${email}` : `id:${uid}`,
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
    if (e instanceof Error && e.message === 'forbidden') {
      return NextResponse.json({ error: 'Fiche non autorisée' }, { status: 403 });
    }
    console.error('[loyalty/activate] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
