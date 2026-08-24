import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifySalesLink } from '@/lib/sales-attribution';
import { generateDemoClaimedEmail } from '@/lib/emails/salesDemoClaimed';

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
      const providerName: string = provider.data()?.businessName ?? 'Un prospect';
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
      return { status: 200 as const, alreadyClaimed: false, providerName };
    });

    // Conversion depuis une DÉMO : marquer la démo et prévenir son commercial
    // dans la minute — le moment que tout le travail de démonstration prépare.
    // Best-effort : l'attribution est déjà écrite, rien ici ne doit la faire
    // échouer ni retarder la réponse au client.
    if (!('error' in result) && !result.alreadyClaimed) {
      const demoMatch = /^demo-([A-Za-z0-9]{10,30})$/.exec(verified.payload.campaign ?? '');
      const nomProvider: string =
        ('providerName' in result && result.providerName) || 'Un prospect';
      if (demoMatch) {
        void (async () => {
          try {
            const demoRef = db.collection('salesDemoLinks').doc(demoMatch[1]);
            const [demoSnap, staffSnap] = await Promise.all([
              demoRef.get(),
              db.collection('staffMembers').doc(verified.payload.staffUid).get(),
            ]);
            await demoRef.update({
              claimedByProviderId: uid,
              claimedProviderName: nomProvider,
              claimedAt: FieldValue.serverTimestamp(),
            });
            const staffEmail = staffSnap.data()?.email;
            const resendApiKey = process.env.RESEND_API_KEY;
            if (staffEmail && resendApiKey) {
              const { Resend } = await import('resend');
              const { subject, html } = generateDemoClaimedEmail({
                staffName: staffSnap.data()?.displayName ?? null,
                providerName: nomProvider,
                demoName: demoSnap.data()?.businessName ?? nomProvider,
                appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com',
              });
              await new Resend(resendApiKey).emails.send({
                from: 'Opatam <noreply@kamerleontech.com>',
                to: staffEmail,
                subject,
                html,
              });
            }
          } catch (e) {
            console.warn('[attribution/claim] notification démo échouée:', e);
          }
        })();
      }
    }

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, alreadyClaimed: result.alreadyClaimed });
  } catch (e) {
    console.error('[attribution/claim] error:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
