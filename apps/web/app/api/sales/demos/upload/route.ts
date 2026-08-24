import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireStaff } from '@/lib/admin-auth';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebase-admin';

/**
 * POST multipart { id, kind: 'logo' | 'cover', file } — photo personnalisée
 * d'une démo. Le logo remplace le portrait de la page, la couverture
 * remplace celle du secteur. C'est ce qui fait passer la démo de « une page
 * de ce genre » à « MA page ».
 *
 * Écrit par l'Admin SDK dans `salesDemos/{id}/…` : aucune règle Storage à
 * ouvrir. L'URL publique passe par un jeton de téléchargement Firebase —
 * même mécanisme que les photos des prestataires.
 */

const TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const TAILLE_MAX = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Requête multipart attendue' }, { status: 400 });
  }
  const id = form.get('id');
  const kind = form.get('kind');
  const file = form.get('file');
  if (typeof id !== 'string' || !/^[A-Za-z0-9]{10,30}$/.test(id)) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }
  if (kind !== 'logo' && kind !== 'cover') {
    return NextResponse.json({ error: "kind doit être 'logo' ou 'cover'" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  const ext = TYPES.get(file.type);
  if (!ext) {
    return NextResponse.json({ error: 'Format accepté : JPEG, PNG ou WebP' }, { status: 400 });
  }
  if (file.size > TAILLE_MAX) {
    return NextResponse.json({ error: 'Image trop lourde (5 Mo maximum)' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection('salesDemoLinks').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'Démo introuvable' }, { status: 404 });
  if (auth.identity.role === 'sales' && snap.data()?.staffUid !== auth.identity.uid) {
    return NextResponse.json({ error: 'Cette démo ne vous appartient pas' }, { status: 403 });
  }

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    return NextResponse.json({ error: 'Storage non configuré' }, { status: 500 });
  }

  // Nom horodaté : un remplacement ne réutilise jamais le même chemin, les
  // caches CDN ne peuvent pas servir l'ancienne image.
  const chemin = `salesDemos/${id}/${kind}-${Date.now()}.${ext}`;
  const token = randomUUID();
  const bucket = getAdminStorage().bucket(bucketName);
  await bucket.file(chemin).save(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(chemin)}?alt=media&token=${token}`;

  await ref.update({ [`photos.${kind}`]: url });
  return NextResponse.json({ success: true, kind, url });
}
