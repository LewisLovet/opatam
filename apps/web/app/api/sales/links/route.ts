import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { signSalesLink } from '@/lib/sales-attribution';
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Génération d'un lien commercial signé.
 *
 * POST { campaign?, sector? } → { url, token }
 *
 * Le commercial authentifié est TOUJOURS le propriétaire du lien : le jeton
 * porte son uid depuis le serveur, jamais depuis le corps de la requête — un
 * commercial ne génère pas de liens au nom d'un autre.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  // Un lien signé n'a de sens que pour une FICHE commerciale active : la
  // revendication vérifie staffMembers/{uid} — le lien d'un admin sans fiche
  // serait accepté à la signature puis refusé à l'inscription du prospect.
  // Mieux vaut le dire tout de suite que produire un lien mort.
  const fiche = await getAdminFirestore().collection('staffMembers').doc(auth.identity.uid).get();
  if (!fiche.exists || fiche.data()?.active !== true) {
    return NextResponse.json({
      url: null,
      raison:
        'Votre compte n’a pas de fiche commerciale : un lien généré ici ne créditerait personne. Les commerciaux invités ont chacun le leur.',
    });
  }

  const body = await request.json().catch(() => ({}));
  const campaign = typeof body.campaign === 'string' && body.campaign.trim()
    ? body.campaign.trim().slice(0, 60)
    : null;
  const sector = typeof body.sector === 'string' && body.sector.trim()
    ? body.sector.trim().slice(0, 30)
    : null;

  const token = signSalesLink({ staffUid: auth.identity.uid, campaign, sector });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';

  return NextResponse.json({
    url: `${baseUrl}/register?s=${encodeURIComponent(token)}`,
    token,
    campaign,
    sector,
  });
}
