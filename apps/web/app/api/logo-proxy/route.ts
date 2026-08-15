import { NextResponse } from 'next/server';

/**
 * Relais d'images pour les canvas — QR codes avec logo incrusté.
 *
 * POURQUOI IL EXISTE : un canvas dans lequel on dessine une image d'une AUTRE
 * origine devient « contaminé », et le navigateur refuse alors tout export
 * (`toDataURL`, `toBlob`). C'est ce qui cassait le téléchargement du QR code :
 * le logo du pro venait de Firebase Storage, qui ne renvoie pas d'en-tête
 * `Access-Control-Allow-Origin` sur les requêtes GET.
 *
 * Deux issues existent : autoriser le CORS sur le bucket (une opération
 * d'infrastructure), ou faire transiter l'image par notre propre domaine —
 * ce que fait cette route. Servie depuis la même origine, l'image ne
 * contamine plus rien, et le code fonctionne quelle que soit la
 * configuration du bucket.
 *
 * L'optimiseur d'images de Next aurait rendu le même service, mais il est
 * désactivé (`unoptimized: true`) pour ne pas consommer le quota facturé de
 * Vercel.
 *
 * SÉCURITÉ : seules les URL de NOTRE bucket sont relayées. Sans cette
 * restriction, la route deviendrait un proxy ouvert — utilisable pour
 * masquer l'origine de requêtes arbitraires et pour consommer notre bande
 * passante.
 */

/** Hôtes dont on accepte de relayer une image. */
const ALLOWED_HOST = 'firebasestorage.googleapis.com';
/** Notre bucket, tel qu'il apparaît dans le chemin des URL de téléchargement. */
const ALLOWED_BUCKET = 'opatam-da04b';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'Paramètre `url` manquant' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }

  const isOurStorage =
    target.protocol === 'https:' &&
    target.hostname === ALLOWED_HOST &&
    target.pathname.includes(ALLOWED_BUCKET);

  if (!isOurStorage) {
    return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    // Le token de téléchargement est déjà dans l'URL : aucun en-tête
    // d'authentification à transmettre.
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream?.ok) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  // Un relais d'images ne doit servir que des images : renvoyer autre chose
  // exposerait du HTML ou du JSON sur notre domaine.
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Type de contenu inattendu' }, { status: 415 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      // Les URL de Storage portent un token stable : le contenu ne change pas
      // sans que l'URL change. On peut donc mettre en cache longuement, ce
      // qui limite les appels à cette fonction.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
