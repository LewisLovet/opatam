/**
 * Gestion de l'abonnement agenda du prestataire.
 *
 *   GET    → état courant (activé ? URL ? dernière consultation ?)
 *   POST   → active, ou régénère le jeton (l'ancien lien meurt aussitôt)
 *   DELETE → désactive (le flux renvoie 404, l'agenda se vide)
 *
 * Auth : Bearer Firebase. L'uid vérifié EST le providerId — un pro ne peut
 * agir que sur son propre flux.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { generateFeedToken } from '@/lib/calendar-feed';
import { appConfig } from '@/lib/resend';
import { networkInterfaces } from 'os';

async function requireProvider(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(header.slice('Bearer '.length));
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Base publique du flux.
 *
 * En production c'est toujours le domaine officiel.
 *
 * En développement, l'URL doit être joignable DEPUIS LE TÉLÉPHONE : ni
 * `localhost`, ni `0.0.0.0`, qui ne désignent rien pour lui. On prend
 * donc l'en-tête `Host` de la requête, c'est-à-dire l'adresse par
 * laquelle l'app a effectivement appelé l'API — et si cette adresse est
 * une adresse d'écoute (le serveur de dev est lié à 0.0.0.0), on résout
 * l'IP du réseau local de la machine.
 */
function feedOrigin(req: NextRequest): string {
  if (process.env.NODE_ENV === 'production') return appConfig.url;

  const host = req.headers.get('host') ?? '';
  const [hostname, port = '3000'] = host.split(':');
  const unusable = !hostname || hostname === '0.0.0.0' || hostname === 'localhost' || hostname === '127.0.0.1';
  if (!unusable) return `http://${host}`;

  const lanIp = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  return lanIp ? `http://${lanIp}:${port}` : appConfig.url;
}

/**
 * Où vit le jeton du flux : la fiche du salon pour le gérant, son
 * `memberAccounts/{uid}` pour un membre de l'équipe (espace membre) — dont
 * le flux ne contient que SES rendez-vous. `null` : ni l'un ni l'autre.
 */
async function documentDuFlux(uid: string) {
  const db = getAdminFirestore();
  const provider = db.collection('providers').doc(uid);
  const snapProvider = await provider.get();
  if (snapProvider.exists) return { ref: provider, data: snapProvider.data() ?? {} };
  const compte = db.collection('memberAccounts').doc(uid);
  const snapCompte = await compte.get();
  if (snapCompte.exists && snapCompte.data()?.active === true) return { ref: compte, data: snapCompte.data() ?? {} };
  return null;
}

function feedUrls(token: string, origin: string) {
  const https = `${origin}/api/calendar/feed/${token}`;
  return {
    url: https,
    // `webcal://` déclenche la fenêtre d'abonnement native d'iOS et de
    // macOS en un seul appui. Même URL, autre schéma.
    webcalUrl: https.replace(/^https?:\/\//, 'webcal://'),
  };
}

export async function GET(req: NextRequest) {
  const uid = await requireProvider(req);
  if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const doc = await documentDuFlux(uid);
  if (!doc) return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });

  const token = doc.data.calendarFeedToken as string | undefined;
  const lastAccess = doc.data.calendarFeedLastAccessAt as
    | { toDate?: () => Date }
    | undefined;

  return NextResponse.json({
    enabled: !!token,
    ...(token ? feedUrls(token, feedOrigin(req)) : { url: null, webcalUrl: null }),
    lastAccessAt: lastAccess?.toDate?.()?.toISOString() ?? null,
  });
}

export async function POST(req: NextRequest) {
  const uid = await requireProvider(req);
  if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const doc = await documentDuFlux(uid);
  if (!doc) {
    return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
  }
  const ref = doc.ref;

  // Régénérer, c'est simplement écrire un nouveau jeton : l'ancien lien ne
  // correspond plus à aucun prestataire et renvoie 404.
  const token = generateFeedToken();
  await ref.update({
    calendarFeedToken: token,
    calendarFeedEnabledAt: new Date(),
    calendarFeedLastAccessAt: null,
  });

  return NextResponse.json({
    enabled: true,
    ...feedUrls(token, feedOrigin(req)),
    lastAccessAt: null,
  });
}

export async function DELETE(req: NextRequest) {
  const uid = await requireProvider(req);
  if (!uid) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const doc = await documentDuFlux(uid);
  if (!doc) return NextResponse.json({ error: 'Prestataire introuvable' }, { status: 404 });
  await doc.ref.update({ calendarFeedToken: null, calendarFeedLastAccessAt: null });

  return NextResponse.json({ enabled: false, url: null, webcalUrl: null, lastAccessAt: null });
}
