process.env.TZ = 'Europe/Paris';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import {
  hasLoyaltyAccess,
  isLoyaltyConfigValid,
  isLoyaltyRewardArmed,
  loyaltyRemaining,
  type LoyaltySettings,
} from '@booking-app/shared';

/**
 * GET /api/loyalty/me — l'espace fidélité du client connecté.
 *
 * Retourne, pour chaque prestataire chez qui le client a un historique ET
 * dont la carte de fidélité est active (réglages valides + gate d'accès),
 * une carte SANITISÉE : progression, seuil, récompense.
 *
 * SÉCURITÉ : on ne renvoie JAMAIS le doc ProviderClient brut — il contient
 * les notes privées du pro sur ce client (notes, tags, revenus). Seuls les
 * champs listés ici sortent. Auth par Firebase ID token (Bearer) : les
 * clients anonymes (résa par email sans compte) n'ont pas d'espace fidélité —
 * leur réduction s'applique quand même à la résa, simplement sans écran de
 * suivi.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    const uid = decoded.uid;

    const db = getAdminFirestore();
    // Les fiches client d'un utilisateur inscrit portent son uid (champ
    // `clientId`, posé par le trigger onBookingWrite / le patch de la route
    // de création). Une seule requête d'égalité — pas d'index composite.
    const snap = await db
      .collection('providerClients')
      .where('clientId', '==', uid)
      .limit(100)
      .get();

    if (snap.empty) return NextResponse.json({ cards: [] });

    // Charge les prestataires concernés en parallèle pour joindre nom/photo
    // et évaluer le gate + les réglages fidélité à la lecture.
    const entries = snap.docs.map((d) => d.data());
    const providers = await Promise.all(
      entries.map((c) => db.collection('providers').doc(c.providerId as string).get()),
    );

    const cards = entries.flatMap((client, i) => {
      const p = providers[i].data();
      if (!p || !p.isPublished) return [];
      const loyalty = (p.settings?.loyalty ?? null) as LoyaltySettings | null;
      if (!isLoyaltyConfigValid(loyalty) || !hasLoyaltyAccess(p)) return [];
      // Compteur FIDÉLITÉ : seuls les RDV faits connecté après le lancement
      // remplissent la carte (le champ API garde son nom pour le mobile).
      const confirmedCount = (client.loyaltyConfirmedCount as number | undefined) ?? 0;
      return [
        {
          providerId: providers[i].id,
          businessName: (p.businessName as string) ?? '',
          slug: (p.slug as string) ?? null,
          photoURL: (p.photoURL as string) ?? null,
          confirmedCount,
          threshold: loyalty.threshold,
          rewardType: loyalty.rewardType,
          rewardValue: loyalty.rewardValue,
          /** RDV restants avant récompense (0 = la prochaine résa est réduite). */
          remaining: loyaltyRemaining(confirmedCount, loyalty.threshold),
          armed: isLoyaltyRewardArmed(confirmedCount, loyalty.threshold),
        },
      ];
    });

    // Cartes armées d'abord, puis les plus proches de la récompense.
    cards.sort((a, b) => Number(b.armed) - Number(a.armed) || a.remaining - b.remaining);

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('[loyalty/me] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
