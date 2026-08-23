import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifySalesLink } from '@/lib/sales-attribution';

/**
 * Revendication d'attribution — appelée UNE fois, juste après l'inscription
 * d'un prestataire arrivé par un lien commercial.
 *
 * Trois garanties :
 *  - le jeton est vérifié cryptographiquement (signature + expiration) ;
 *  - l'appelant est authentifié et ne revendique que pour SON compte
 *    (uid du jeton Firebase = providerId, Provider.id === User.id) ;
 *  - PREMIÈRE ATTRIBUTION DÉFINITIVE : transaction, un compte déjà attribué
 *    n'est jamais réattribué — même patron que l'affiliation, pour la même
 *    raison (la rémunération de quelqu'un en dépend).
 *
 * `salesAttribution/{providerId}` : une attribution par compte, la clé rend
 * le doublon structurellement impossible.
 */
export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(header.slice(7))).uid;
    } catch {
      return NextResponse.json({ error: 'Jeton invalide' }, { status: 401 });
    }

    const { token } = await request.json();
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ error: 'token requis' }, { status: 400 });
    }
    const verified = verifySalesLink(token);
    if (!verified.ok) {
      return NextResponse.json({ error: `Lien invalide (${verified.reason})` }, { status: 400 });
    }

    const db = getAdminFirestore();
    const providerRef = db.collection('providers').doc(uid);
    const attributionRef = db.collection('salesAttribution').doc(uid);
    const staffRef = db.collection('staffMembers').doc(verified.payload.staffUid);

    const result = await db.runTransaction(async (tx) => {
      const [provider, attribution, staff] = await Promise.all([
        tx.get(providerRef),
        tx.get(attributionRef),
        tx.get(staffRef),
      ]);
      if (!provider.exists) return { status: 404 as const, error: 'Compte prestataire introuvable' };
      if (attribution.exists) return { status: 200 as const, alreadyClaimed: true };
      // Un lien d'un commercial désactivé ou supprimé n'attribue plus rien.
      if (!staff.exists || staff.data()?.active !== true) {
        return { status: 400 as const, error: 'Lien commercial inactif' };
      }

      tx.set(attributionRef, {
        providerId: uid,
        staffUid: verified.payload.staffUid,
        campaign: verified.payload.campaign,
        sector: verified.payload.sector,
        linkIssuedAt: new Date(verified.payload.issuedAt * 1000),
        claimedAt: FieldValue.serverTimestamp(),
      });
      return { status: 200 as const, alreadyClaimed: false };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, alreadyClaimed: result.alreadyClaimed });
  } catch (e) {
    console.error('[attribution/claim] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
