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
import {
  buildLoyaltyCardIdentity,
  loyaltyRedemptionKey,
  type OwnedProviderClient,
} from '@/lib/loyalty-identity';

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
 *
 * UNE SEULE CARTE PAR PRESTATAIRE. Un client qui a réservé sous deux
 * adresses possède deux fiches `providerClients` (le CRM les découpe par
 * email) : elles sont réunies ici en une carte unique, identifiée par
 * (clientId, providerId). Voir `lib/loyalty-identity`.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    const uid = decoded.uid;
    const accountEmail = decoded.email?.toLowerCase().trim() ?? null;

    const db = getAdminFirestore();
    // Les fiches client d'un utilisateur inscrit portent son uid (champ
    // `clientId`, posé par le trigger onBookingWrite / le patch de la route
    // de création). Une seule requête d'égalité — pas d'index composite.
    //
    // SECONDE REQUÊTE, par ADRESSE. Une cliente qui possède l'application
    // mais réserve depuis le lien web du salon sans s'y connecter produit
    // une fiche SANS `clientId` : la première requête ne la voit pas, et
    // elle n'avait donc AUCUNE carte à l'écran chez ce prestataire — pas
    // même une carte vide. C'est ce que remontaient les prestataires.
    //
    // Purement de l'AFFICHAGE : la fiche remonte, mais son compteur reste
    // ce qu'il est. La politique « app requise » (seules les résas faites
    // connecté remplissent la carte) n'est pas touchée — la cliente voit
    // sa carte à zéro et l'invitation à réserver depuis l'app.
    const [byUid, byEmail] = await Promise.all([
      db.collection('providerClients').where('clientId', '==', uid).limit(100).get(),
      accountEmail
        ? db.collection('providerClients').where('email', '==', accountEmail).limit(100).get()
        : Promise.resolve(null),
    ]);

    // Dédoublonnage par id : une fiche rattachée remonte dans les DEUX
    // requêtes. On écarte aussi les fiches d'un autre compte qui
    // partageraient l'adresse — le `clientId` fait foi quand il existe.
    const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const d of byUid.docs) docsById.set(d.id, d);
    for (const d of byEmail?.docs ?? []) {
      const owner = d.data().clientId as string | undefined;
      if (!owner || owner === uid) docsById.set(d.id, d);
    }
    const snap = { docs: [...docsById.values()], empty: docsById.size === 0 };

    if (snap.empty) return NextResponse.json({ cards: [] });

    // Regroupement par prestataire AVANT toute lecture : c'est ce qui
    // garantit qu'un client ayant plusieurs fiches chez le même pro ne voit
    // jamais deux cartes.
    const byProvider = new Map<string, OwnedProviderClient[]>();
    for (const d of snap.docs) {
      const data = d.data();
      const pid = data.providerId as string | undefined;
      if (!pid) continue;
      const owned: OwnedProviderClient = {
        ref: d.ref,
        data,
        clientKey: (data.clientKey as string) ?? d.id.slice(pid.length + 1),
      };
      byProvider.set(pid, [...(byProvider.get(pid) ?? []), owned]);
    }

    const entries = [...byProvider.entries()].map(([providerId, docs]) => ({
      providerId,
      card: buildLoyaltyCardIdentity(docs),
    }));

    // Charge les prestataires concernés en parallèle pour joindre nom/photo
    // et évaluer le gate + les réglages fidélité à la lecture.
    const providers = await Promise.all(
      entries.map((e) => db.collection('providers').doc(e.providerId).get()),
    );

    const rawCards = entries.flatMap(({ card }, i) => {
      const p = providers[i].data();
      if (!p || !p.isPublished) return [];
      const loyalty = (p.settings?.loyalty ?? null) as LoyaltySettings | null;
      if (!isLoyaltyConfigValid(loyalty) || !hasLoyaltyAccess(p)) return [];
      // Compteur FIDÉLITÉ : seuls les RDV faits connecté après le lancement
      // ET passés remplissent la carte — PLUS le delta manuel du pro
      // (fidélité v2). Les deux sont SOMMÉS sur toutes les fiches du client
      // chez ce pro. Le champ API `confirmedCount` reste le compte effectif
      // affiché, inchangé pour le mobile.
      const confirmedCount = card.effectiveCount;
      const activated = card.activated;
      return [
        {
          // Clés de rédemption de CETTE carte, retirées avant la réponse.
          legacyKeys: card.all.map((d) => d.clientKey),
          providerId: providers[i].id,
          businessName: (p.businessName as string) ?? '',
          slug: (p.slug as string) ?? null,
          photoURL: (p.photoURL as string) ?? null,
          confirmedCount,
          threshold: loyalty.threshold,
          rewardType: loyalty.rewardType,
          rewardValue: loyalty.rewardValue,
          remaining: loyaltyRemaining(confirmedCount, loyalty.threshold),
          // Fidélité v2 : pas de récompense armée tant que la carte n'est
          // pas activée (même gate que la route de réservation).
          armed: activated && isLoyaltyRewardArmed(confirmedCount, loyalty.threshold),
          // Nouveaux champs pour le bouton « Activer ma carte » + opt-in.
          activated,
          promoEmailsOptIn: card.promoEmailsOptIn,
        },
      ];
    });

    // Récompense déjà consommée ce cycle (ticket de rédemption existant,
    // résa réduite pas encore passée) → la carte redémarre côté affichage.
    const cards = await Promise.all(
      rawCards.map(async ({ legacyKeys, ...card }) => {
        if (!card.armed) return card;
        const cycle = card.confirmedCount / card.threshold;
        // Clé stable (uid) + clés héritées (une par fiche) : un ticket émis
        // avant l'unification de la carte doit toujours compter, sinon la
        // récompense serait accordée une seconde fois.
        const keys = [...new Set([loyaltyRedemptionKey(uid), ...legacyKeys])];
        const tickets = await Promise.all(
          keys.map((k) =>
            db.collection('loyaltyRedemptions').doc(`${card.providerId}_${k}_c${cycle}`).get(),
          ),
        );
        if (!tickets.some((t) => t.exists)) return card;
        return { ...card, armed: false, remaining: card.threshold };
      }),
    );

    // Cartes armées d'abord, puis les plus proches de la récompense.
    cards.sort((a, b) => Number(b.armed) - Number(a.armed) || a.remaining - b.remaining);

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('[loyalty/me] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
