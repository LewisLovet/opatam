import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { signSalesLink } from '@/lib/sales-attribution';

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
