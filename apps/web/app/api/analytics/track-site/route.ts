import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isSiteMetricKey, metricDay, metricDocId } from '@/lib/siteMetrics';

/**
 * POST /api/analytics/track-site
 *
 * Incrémente un compteur journalier du site. Une écriture atomique, appelée
 * sans attendre la réponse depuis le client.
 *
 * ── CE QUE CETTE ROUTE NE PEUT PAS GARANTIR ───────────────────────────────
 *
 * Elle est publique par nécessité : la mesure a lieu avant toute
 * authentification. Les deux garde-fous ci-dessous arrêtent le script naïf et
 * le rechargement en boucle, PAS un adversaire décidé — qui n'aurait qu'à
 * varier ses adresses et poser le bon en-tête.
 *
 * Les chiffres de l'entonnoir sont donc INDICATIFS. Ils valent pour lire une
 * tendance, jamais comme source de vérité. Une mesure inviolable demanderait
 * une limitation en amont (pare-feu Vercel ou Cloudflare, par adresse et sur
 * fenêtre courte), qui n'est pas en place.
 */

/** Origines admises. Une requête sans origine reconnue n'est pas un visiteur. */
const ORIGINES = ['https://opatam.com', 'https://www.opatam.com'];

/**
 * Fenêtre anti-rafale, en mémoire du processus.
 *
 * Volontairement PAS dans Firestore : une limitation qui écrit à chaque
 * requête coûterait exactement ce qu'elle prétend éviter. En mémoire, elle ne
 * couvre qu'une instance à la fois — c'est une atténuation, pas une barrière,
 * et l'en-tête de ce fichier le dit.
 */
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 12;
const vues = new Map<string, { debut: number; n: number }>();

function tropDeRequetes(cle: string): boolean {
  const maintenant = Date.now();
  const e = vues.get(cle);
  if (!e || maintenant - e.debut > FENETRE_MS) {
    vues.set(cle, { debut: maintenant, n: 1 });
    // Purge opportuniste : sans elle la carte grossit indéfiniment sur une
    // instance longue-durée.
    if (vues.size > 5000) {
      for (const [k, v] of vues) {
        if (maintenant - v.debut > FENETRE_MS) vues.delete(k);
      }
    }
    return false;
  }
  e.n += 1;
  return e.n > MAX_PAR_FENETRE;
}

export async function POST(request: NextRequest) {
  try {
    const origine = request.headers.get('origin') ?? '';
    if (origine && !ORIGINES.includes(origine)) {
      return NextResponse.json({ error: 'Bad origin' }, { status: 403 });
    }

    const { key } = await request.json();
    if (!isSiteMetricKey(key)) {
      return NextResponse.json({ error: 'Unknown metric key' }, { status: 400 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'inconnue';
    if (tropDeRequetes(`${ip}|${key}`)) {
      // 204 et non 429 : le client n'a rien à faire de cette information, et
      // une erreur visible apprendrait à un script où se situe la limite.
      return new NextResponse(null, { status: 204 });
    }

    const day = metricDay();
    const db = getAdminFirestore();
    await db
      .collection('siteMetricsDaily')
      .doc(metricDocId(key, day))
      .set({ day, key, count: FieldValue.increment(1) }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TRACK-SITE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
